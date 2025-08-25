<?php

/**
 * @file plugins/generic/premiumSubmissionHelper/PremiumSubmissionHelperPlugin.php
 *
 * Copyright (c) 2025 Premium Submission Helper Plugin
 * Distribué sous la licence GNU GPL v3. Pour les conditions complètes, voir le fichier docs/COPYING.
 *
 * @class PremiumSubmissionHelperPlugin
 *
 * @ingroup plugins_generic_premiumSubmissionHelper
 *
 * @package plugins_generic_premiumSubmissionHelper
 * @category Generic
 *
 * @author Premium Submission Helper Plugin
 * @license GNU GPL v3
 *
 * @link https://github.com/premium-submission-helper
 *
 * @brief Plugin OJS avec intégration de l'analyse IA Santaane
 */

// Ce fichier ne doit déclarer que des symboles (classes, fonctions, constantes, etc.)
// et ne doit pas exécuter de logique ayant des effets de bord.
// Toute logique avec effet de bord doit être déplacée dans un autre fichier (ex : index.php).

namespace APP\plugins\generic\premiumSubmissionHelper;

use APP\core\Application;
use Illuminate\Support\Facades\DB;
use PKP\core\JSONMessage;
use PKP\facades\Locale;
use PKP\linkAction\LinkAction;
use PKP\linkAction\request\AjaxModal;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;
use PKP\security\Role;

/**
 * PremiumSubmissionHelperPlugin class
 *
 * Plugin OJS qui ajoute des fonctionnalités d'analyse IA Santaane
 * pour les utilisateurs premium lors de la soumission d'articles.
 */
class PremiumSubmissionHelperPlugin extends GenericPlugin
{
    /**
     * @copydoc Plugin::register()
     *
     * @param string $category The category name
     * @param string $path The plugin path
     * @param null|mixed $mainContextId The main context ID
     *
     * @return bool
     */
    public function register($category, $path, $mainContextId = null)
    {
        $success = parent::register($category, $path, $mainContextId);
        if (Application::isUnderMaintenance()) {
            return true;
        }

        if ($success && $this->getEnabled($mainContextId)) {
            // Register template display hook for general injection
            Hook::add('TemplateManager::display', [$this, 'handleTemplateDisplay']);

            // Initialize premium roles if they don't exist
            $this->_initializePremiumRoles($mainContextId);
        }

        return $success;
    }

    /**
     * @copydoc Plugin::getInstallSitePluginSettingsFile()
     *
     */
    public function getInstallSitePluginSettingsFile(): string
    {
        return $this->getPluginPath() . '/settings.xml';
    }

    /**
     * @copydoc Plugin::getDisplayName()
     *
     * @return string
     */
    public function getDisplayName()
    {
        return __('plugins.generic.premiumSubmissionHelper.displayName');
    }

    /**
     * @copydoc Plugin::getDescription()
     *
     * @return string
     */
    public function getDescription()
    {
        return __('plugins.generic.premiumSubmissionHelper.description');
    }

    /**
     * Initialize premium roles when the plugin is enabled
     *
     * @param int|null $contextId The context ID
     *
     */
    private function initializePremiumRoles($contextId = null)
    {
        try {
            // Check if premium groups already exist
            $existingGroups = DB::table('user_group_settings')
                ->where('setting_name', 'premiumGroupType')
                ->where('setting_value', 'Premium')
                ->count();

            if ($existingGroups === 0) {
                // Create premium groups automatically
                $this->createPremiumRoles();

                // Log success
                error_log('[PremiumSubmissionHelper] Premium groups created successfully during plugin activation');
            }
        } catch (\Exception $e) {
            // Log error but don't break plugin functionality
            error_log('[PremiumSubmissionHelper] Error creating premium groups: ' . $e->getMessage());
        }
    }

    /**
     * Create premium roles in the database
     *
     */
    private function createPremiumRoles()
    {
        // Get installed contexts (journals)
        $contexts = DB::table('journals')
            ->select(['journal_id', 'primary_locale'])
            ->get();

        // Get installed locales
        $installedLocales = json_decode(
            DB::table('site')->select('installed_locales')->first()->installed_locales ?? '["en_US"]',
            true
        ) ?: ['en_US'];

        // Create premium roles for each context
        foreach ($contexts as $context) {
            $this->createPremiumRolesForContext($context->journal_id, $context->primary_locale, $installedLocales);
        }

        // Create premium roles at site level (global context)
        $this->createPremiumRolesForContext(0, 'en_US', $installedLocales);
    }

    /**
     * Create premium roles for a specific context
     *
     * @param int    $contextId        The context ID (0 for site)
     * @param string $primaryLocale    The primary locale
     * @param array  $installedLocales Installed locales
     *
     */
    private function createPremiumRolesForContext(int $contextId, string $primaryLocale, array $installedLocales)
    {
        // Only create ONE Premium role (not VIP, Advanced, Elite)
        $premiumRoleConfigs = [
            'Premium' => [
                'role_id' => Role::ROLE_ID_AUTHOR, // Use existing AUTHOR role
                'name' => 'Premium',
                'abbrev' => 'PRM',
                'description' => 'Auteur Premium avec accès à l\'analyse IA'
            ]
        ];

        foreach ($premiumRoleConfigs as $roleKey => $roleInfo) {
            // Check if premium group already exists for this context
            $existingGroup = DB::table('user_groups')
                ->where('context_id', $contextId)
                ->where('role_id', $roleInfo['role_id'])
                ->whereIn('user_group_id', function ($query) use ($contextId) {
                    $query->select('user_group_id')
                        ->from('user_group_settings')
                        ->where('context_id', $contextId)
                        ->where('setting_name', 'premiumGroupType')
                        ->where('setting_value', 'Premium');
                })
                ->first();

            if (!$existingGroup) {
                // Create user group using existing OJS role
                $userGroupId = DB::table('user_groups')->insertGetId([
                    'context_id' => $contextId,
                    'role_id' => $roleInfo['role_id'], // Use existing OJS role
                    'is_default' => false,
                    'show_title' => true,
                    'permit_self_registration' => false,
                    'permit_metadata_edit' => true,
                    'permit_settings' => false,
                    'masthead' => false,
                ]);

                // Add user group settings
                $this->addUserGroupSettings($userGroupId, $roleInfo, $primaryLocale, $installedLocales);

                // Add author permissions for premium roles
                $this->addAuthorPermissions($userGroupId, $contextId);

                // Mark this as a premium group
                DB::table('user_group_settings')->insert([
                    'user_group_id' => $userGroupId,
                    'locale' => '',
                    'setting_name' => 'premiumGroupType',
                    'setting_value' => $roleKey
                ]);
            }
        }
    }

    /**
     * Add settings for user group
     *
     * @param int    $userGroupId      The user group ID
     * @param array  $roleInfo         Role information
     * @param string $primaryLocale    Primary locale
     * @param array  $installedLocales Installed locales
     *
     */
    private function addUserGroupSettings(
        int $userGroupId,
        array $roleInfo,
        string $primaryLocale,
        array $installedLocales
    ) {
        // Add localization keys
        DB::table('user_group_settings')->insert([
            [
                'user_group_id' => $userGroupId,
                'locale' => '',
                'setting_name' => 'nameLocaleKey',
                'setting_value' => 'user.role.' . strtolower($roleInfo['name'])
            ],
            [
                'user_group_id' => $userGroupId,
                'locale' => '',
                'setting_name' => 'abbrevLocaleKey',
                'setting_value' => 'user.role.abbrev.' . strtolower($roleInfo['name'])
            ]
        ]);

        // Add translations for each locale
        foreach ($installedLocales as $locale) {
            // Role name
            $translatedName = $this->getTranslatedRoleName(
                $roleInfo['name'],
                $locale,
                $primaryLocale
            );
            if ($translatedName) {
                DB::table('user_group_settings')->insert([
                    'user_group_id' => $userGroupId,
                    'locale' => $locale,
                    'setting_name' => 'name',
                    'setting_value' => $translatedName
                ]);
            }

            // Role abbreviation
            $translatedAbbrev = $this->getTranslatedRoleAbbrev(
                $roleInfo['abbrev'],
                $locale,
                $primaryLocale
            );
            if ($translatedAbbrev) {
                DB::table('user_group_settings')->insert([
                    'user_group_id' => $userGroupId,
                    'locale' => $locale,
                    'setting_name' => 'abbrev',
                    'setting_value' => $translatedAbbrev
                ]);
            }
        }
    }

    /**
     * Add author permissions to a user group
     *
     * @param int $userGroupId The user group ID
     * @param int $contextId   The context ID
     *
     */
    private function addAuthorPermissions(int $userGroupId, int $contextId): void
    {
        // Define author permissions for premium users
        $authorPermissions = [
            // Permissions de base d'auteur
            'canSubmit' => true,           // Peut soumettre des articles
            'canEdit' => true,             // Peut éditer ses articles
            'canReview' => true,           // Peut faire des revues
            'canPublish' => false,         // Ne peut pas publier directement
            'canDelete' => false,          // Ne peut pas supprimer
            'canManage' => false,          // Ne peut pas gérer

            // Permissions de consultation
            'canView' => true,             // Peut voir les articles
            'canComment' => true,          // Peut commenter
            'canRate' => true,             // Peut évaluer
            'canBookmark' => true,         // Peut marquer des articles
            'canShare' => true,            // Peut partager

            // Permissions d'export et d'impression
            'canExport' => true,           // Peut exporter
            'canPrint' => true,            // Peut imprimer
            'canEmail' => true,            // Peut envoyer par email
            'canDownload' => true,         // Peut télécharger

            // Permissions d'historique et de suivi
            'canViewHistory' => true,      // Peut voir l'historique
            'canViewNotes' => true,        // Peut voir les notes
            'canViewReviews' => true,      // Peut voir les revues
            'canViewComments' => true,     // Peut voir les commentaires
            'canViewRatings' => true,      // Peut voir les évaluations
            'canViewBookmarks' => true,    // Peut voir ses marque-pages
            'canViewShares' => true,       // Peut voir ses partages
            'canViewExports' => true,      // Peut voir ses exports
            'canViewPrints' => true,       // Peut voir ses impressions
            'canViewEmails' => true,       // Peut voir ses emails
            'canViewDownloads' => true,    // Peut voir ses téléchargements

            // Permissions premium spécifiques
            'canUseAI' => true,            // Peut utiliser l'analyse IA
            'canAccessPremium' => true,    // Accès aux fonctionnalités premium
            'canViewAnalytics' => true,    // Peut voir les analyses
            'canUseAdvancedFeatures' => true, // Peut utiliser les fonctionnalités avancées
        ];

        // Add author permissions to user group settings
        DB::table('user_group_settings')->insert([
            'user_group_id' => $userGroupId,
            'locale' => '',
            'setting_name' => 'authorPermissions',
            'setting_value' => json_encode($authorPermissions)
        ]);

        // Add specific role permissions for premium access
        DB::table('user_group_settings')->insert([
            'user_group_id' => $userGroupId,
            'locale' => '',
            'setting_name' => 'premiumPermissions',
            'setting_value' => json_encode([
                'aiAnalysis' => true,      // Accès à l'analyse IA
                'premiumFeatures' => true, // Accès aux fonctionnalités premium
                'advancedTools' => true,   // Accès aux outils avancés
                'prioritySupport' => true, // Support prioritaire
                'extendedStorage' => true, // Stockage étendu
                'customBranding' => true,  // Personnalisation de la marque
            ])
        ]);
    }

    /**
     * Get translated role name
     *
     * @param string $roleName      Role name in English
     * @param string $locale        Target locale
     * @param string $primaryLocale Primary locale
     *
     * @return string|null Translated name or null if no translation
     */
    private function getTranslatedRoleName(
        string $roleName,
        string $locale,
        string $primaryLocale
    ): ?string {
        // French translations
        $frenchTranslations = [
            'Premium' => 'Premium'
        ];

        // Spanish translations
        $spanishTranslations = [
            'Premium' => 'Premium'
        ];

        // German translations
        $germanTranslations = [
            'Premium' => 'Premium'
        ];

        $translations = [
            'fr' => $frenchTranslations,
            'es' => $spanishTranslations,
            'de' => $germanTranslations
        ];

        $localePrefix = substr($locale, 0, 2);

        if (
            isset($translations[$localePrefix])
            && isset($translations[$localePrefix][$roleName])
        ) {
            return $translations[$localePrefix][$roleName];
        }

        // Return original name if no translation
        return $roleName;
    }

    /**
     * Get translated role abbreviation
     *
     * @param string $roleAbbrev    Role abbreviation in English
     * @param string $locale        Target locale
     * @param string $primaryLocale Primary locale
     *
     * @return string|null Translated abbreviation or null if no translation
     */
    private function getTranslatedRoleAbbrev(
        string $roleAbbrev,
        string $locale,
        string $primaryLocale
    ): ?string {
        // Abbreviation translations
        $abbrevTranslations = [
            'PRM' => 'PRM'
        ];

        $localePrefix = substr($locale, 0, 2);

        if ($localePrefix === 'fr' && isset($abbrevTranslations[$roleAbbrev])) {
            return $abbrevTranslations[$roleAbbrev];
        }

        // Return original abbreviation for other languages
        return $roleAbbrev;
    }

    /**
     * Check if the current user has Premium access
     *
     * Ultra-simple method: just check if user is in Premium group
     *
     * @param int $contextId The context ID to check roles in
     *
     * @return bool True if user has premium access, false otherwise
     */
    private function isUserPremium($contextId): bool
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();

        if (!$user) {
            return false;
        }

        // Ultra-simple: just check if user is in Premium group
        try {
            $userId = $user->getId();

            // Direct SQL query to check Premium access
            $hasPremium = DB::table('user_groups as ug')
                ->join('user_group_settings as ugs', 'ug.user_group_id', '=', 'ugs.user_group_id')
                ->where('ug.context_id', $contextId)
                ->where('ugs.setting_name', 'premiumGroupType')
                ->where('ugs.setting_value', 'Premium')
                ->whereExists(function ($query) use ($userId) {
                    $query->select(DB::raw(1))
                        ->from('user_user_groups as uug')
                        ->whereRaw('uug.user_group_id = ug.user_group_id')
                        ->where('uug.user_id', $userId);
                })
                ->exists();

            return $hasPremium;
        } catch (\Exception $e) {
            error_log('[PremiumSubmissionHelper] Error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Handle template display hook for injecting CSS and JS
     *
     * @param string $hookName The hook name
     * @param array  $args     The hook arguments
     *
     */
    public function handleTemplateDisplay(
        string $hookName,
        array $args
    ): bool {
        $request = Application::get()->getRequest();
        $templateManager = $args[0];

        // Only inject on submission wizard pages
        $requestPath = $request->getRequestPath();
        if (strpos($requestPath, 'submission') === false) {
            return false;
        }

        // Add CSS file
        $templateManager->addStyleSheet(
            'premiumSubmissionHelper',
            $request->getBaseUrl() . '/plugins/generic/premiumSubmissionHelper/css/premiumSubmissionHelper.css',
            [
                'contexts' => 'backend',
            ]
        );

        // Add JavaScript file
        $templateManager->addJavaScript(
            'premiumSubmissionHelper',
            $request->getBaseUrl() . '/plugins/generic/premiumSubmissionHelper/js/premiumSubmissionHelper.js',
            [
                'contexts' => 'backend',
            ]
        );

        // Add plugin data for JavaScript
        $context = $request->getContext();
        $contextId = $context ? $context->getId() : 0;

        // Check if user is premium using the proper OJS method
        $isPremium = $this->isUserPremium($contextId);

        $data = [
            'pluginUrl' => $request->getBaseUrl() . '/plugins/generic/premiumSubmissionHelper/',
            'contextId' => $contextId,
            'apiUrl' => $request->getDispatcher()->url(
                $request,
                Application::ROUTE_API,
                $context->getPath(),
                'ai-analysis'
            ),
            'locale' => Locale::getLocale(),
            'isPremium' => $isPremium,
        ];

        $templateManager->addJavaScript(
            'premiumSubmissionHelperData',
            '$.pkp.plugins.generic = $.pkp.plugins.generic || {};' .
                '$.pkp.plugins.generic.premiumSubmissionHelper = ' . json_encode($data) . ';',
            [
                'inline' => true,
                'contexts' => 'backend',
            ]
        );

        return false;
    }

    /**
     * @copydoc Plugin::getActions()
     *
     * @param mixed $request The request object
     * @param mixed $verb    The verb
     *
     */
    public function getActions(
        $request,
        $verb
    ): array {
        $router = $request->getRouter();
        return array_merge(
            $this->getEnabled() ? [
                new LinkAction(
                    'settings',
                    new AjaxModal(
                        $router->url(
                            $request,
                            null,
                            null,
                            'manage',
                            null,
                            [
                                'verb' => 'settings',
                                'plugin' => $this->getName(),
                                'category' => 'generic'
                            ]
                        ),
                        $this->getDisplayName()
                    ),
                    __('manager.plugins.settings'),
                    null
                ),
            ] : [],
            parent::getActions($request, $verb)
        );
    }

    /**
     * @copydoc Plugin::manage()
     *
     * @param mixed $args    The arguments
     * @param mixed $request The request object
     *
     */
    public function manage(
        $args,
        $request
    ) {
        switch ($request->getUserVar('verb')) {
            case 'settings':
                return new JSONMessage(
                    true,
                    '<p>' . __('plugins.generic.premiumSubmissionHelper.settings.description')
                        . '</p>'
                );
        }
        return parent::manage($args, $request);
    }
}
