<?php

/**
 * @file plugins/generic/premiumSubmissionHelper/PremiumSubmissionHelperPlugin.php
 *
 * Copyright (c) 2025 Premium Submission Helper Plugin
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PremiumSubmissionHelperPlugin
 *
 * @ingroup plugins_generic_premiumSubmissionHelper
 *
 * @brief Premium Submission Helper Plugin - OJS Plugin with Santaane AI Integration
 *
 * This plugin provides premium features for article submission including AI-powered
 * analysis integration with Santaane platform for premium users during the submission workflow.
 *
 * Key Features:
 * - Automatic creation of Premium user groups
 * - Premium user detection and validation
 * - Integration hooks for submission workflow enhancement
 * - CSS and JavaScript injection for premium UI features
 */

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
 * Premium Submission Helper Plugin Class
 *
 * Provides enhanced submission workflow features for premium users including
 * AI analysis integration and advanced submission tools.
 */
class PremiumSubmissionHelperPlugin extends GenericPlugin
{
    /** @var string Premium user group name */
    private const PREMIUM_GROUP_NAME = 'Premium';

    /** @var string Premium user group abbreviation */
    private const PREMIUM_GROUP_ABBREV = 'VIP';

    /** @var string Default locale for user groups */
    private const DEFAULT_LOCALE = 'en';

    /**
     * @copydoc Plugin::register()
     *
     * @param null|mixed $mainContextId
     */
    public function register($category, $path, $mainContextId = null): bool
    {
        $success = parent::register($category, $path, $mainContextId);

        if (Application::isUnderMaintenance()) {
            return $success;
        }

        if ($success && $this->getEnabled($mainContextId)) {
            $this->initializePlugin();
        }

        return $success;
    }

    /**
     * Initialize plugin functionality
     *
     * Sets up hooks and ensures premium user groups exist.
     */
    private function initializePlugin(): void
    {
        // Register template display hook for CSS/JS injection
        Hook::add('TemplateManager::display', [$this, 'handleTemplateDisplay']);

        // Initialize premium roles if they don't exist
        $this->ensurePremiumGroupsExist();
    }

    /**
     * @copydoc Plugin::getInstallSitePluginSettingsFile()
     */
    public function getInstallSitePluginSettingsFile(): string
    {
        return $this->getPluginPath() . '/settings.xml';
    }

    /**
     * @copydoc Plugin::getDisplayName()
     */
    public function getDisplayName(): string
    {
        return __('plugins.generic.premiumSubmissionHelper.displayName');
    }

    /**
     * @copydoc Plugin::getDescription()
     */
    public function getDescription(): string
    {
        return __('plugins.generic.premiumSubmissionHelper.description');
    }

    /**
     * Ensure premium user groups exist across all journals
     *
     * Creates Premium user groups for all existing journals if they don't already exist.
     * This ensures consistent premium functionality across the entire OJS installation.
     */
    private function ensurePremiumGroupsExist(): void
    {
        try {
            // Check if any premium groups already exist
            $existingPremiumCount = $this->countExistingPremiumGroups();

            if ($existingPremiumCount > 0) {
                return; // Premium groups already exist
            }

            // Create premium groups for all journals
            $this->createPremiumGroupsForAllJournals();
        } catch (\Exception $e) {
            // Fail silently in production - premium features will be disabled
            // In a real implementation, this could be logged to a proper logging system
        }
    }

    /**
     * Count existing premium groups across all contexts
     */
    private function countExistingPremiumGroups(): int
    {
        return DB::table('user_group_settings')
            ->where('setting_name', 'name')
            ->where('setting_value', self::PREMIUM_GROUP_NAME)
            ->count();
    }

    /**
     * Create premium user groups for all existing journals
     *
     * Iterates through all journals and creates a Premium user group for each,
     * ensuring proper foreign key constraints are respected.
     */
    private function createPremiumGroupsForAllJournals(): void
    {
        $journalIds = $this->getExistingJournalIds();

        foreach ($journalIds as $journalId) {
            $this->createPremiumGroupForJournal($journalId);
        }
    }

    /**
     * Get all existing journal IDs
     *
     * @return array<int> Array of journal IDs
     */
    private function getExistingJournalIds(): array
    {
        return DB::table('journals')->pluck('journal_id')->toArray();
    }

    /**
     * Create premium user group for a specific journal
     *
     * @param int $journalId The journal ID to create the premium group for
     */
    private function createPremiumGroupForJournal(int $journalId): void
    {
        try {
            // Check if premium group already exists for this journal
            if ($this->premiumGroupExistsForJournal($journalId)) {
                return;
            }

            // Get journal's primary locale
            $primaryLocale = $this->getJournalPrimaryLocale($journalId);

            // Import DAORegistry for OJS legacy class
            import('lib.pkp.classes.db.DAORegistry');

            // Get UserGroup DAO
            $userGroupDao = DAORegistry::getDAO('UserGroupDAO');
            /** @var \PKP\userGroup\UserGroupDAO $userGroupDao */

            // Create new user group data object
            $userGroup = $userGroupDao->newDataObject();
            $userGroup->setContextId($journalId);
            $userGroup->setRoleId(Role::ROLE_ID_AUTHOR);
            $userGroup->setDefault(false);
            $userGroup->setShowTitle(true);
            $userGroup->setPermitSelfRegistration(false);
            $userGroup->setPermitMetadataEdit(true);
            $userGroup->setPermitSettings(false);
            $userGroup->setMasthead(false);

            // Set localized names using setData method (OJS standard)
            $userGroup->setData('name', self::PREMIUM_GROUP_NAME, $primaryLocale);
            $userGroup->setData('abbrev', self::PREMIUM_GROUP_ABBREV, $primaryLocale);

            // Insert into database using DAO
            $userGroupDao->insertObject($userGroup);
        } catch (\Exception $e) {
            // Log the error for debugging
        }
    }

    /**
     * Check if premium group exists for a specific journal
     *
     * @param int $journalId The journal ID to check
     *
     * @return bool True if premium group exists, false otherwise
     */
    private function premiumGroupExistsForJournal(int $journalId): bool
    {
        try {
            // Get journal's primary locale
            $primaryLocale = $this->getJournalPrimaryLocale($journalId);

            // Import DAORegistry for OJS legacy class
            import('lib.pkp.classes.db.DAORegistry');

            // Get UserGroup DAO
            $userGroupDao = DAORegistry::getDAO('UserGroupDAO');
            /** @var \PKP\userGroup\UserGroupDAO $userGroupDao */

            // Get all user groups for this journal with author role
            $userGroups = $userGroupDao->getByRoleId($journalId, Role::ROLE_ID_AUTHOR);

            // Check if any group has the Premium name
            foreach ($userGroups as $userGroup) {
                if ($userGroup->getData('name', $primaryLocale) === self::PREMIUM_GROUP_NAME) {
                    return true;
                }
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get primary locale for a journal or context
     *
     * @param int $contextId The context ID (journal ID or 0 for global)
     *
     * @return string The primary locale (falls back to default if not found)
     */
    private function getJournalPrimaryLocale(int $contextId): string
    {
        try {
            // For global context (0), return default locale
            if ($contextId === 0) {
                return self::DEFAULT_LOCALE;
            }

            // Use database query to get primary locale directly
            $primaryLocale = DB::table('journal_settings')
                ->where('journal_id', $contextId)
                ->where('setting_name', 'primaryLocale')
                ->value('setting_value');

            return $primaryLocale ?: self::DEFAULT_LOCALE;
        } catch (\Exception $e) {
            return self::DEFAULT_LOCALE;
        }
    }

    /**
     * Check if the current user has Premium access for a given context
     *
     * @param int $contextId The context ID to check premium access for
     *
     * @return bool True if user has premium access, false otherwise
     */
    private function isUserPremium(int $contextId): bool
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();

        if (!$user) {
            return false;
        }

        try {
            $userId = $user->getId();

            // Import DAORegistry for OJS legacy class
            import('lib.pkp.classes.db.DAORegistry');

            // Get UserGroup DAO
            $userGroupDao = DAORegistry::getDAO('UserGroupDAO');
            /** @var \PKP\userGroup\UserGroupDAO $userGroupDao */

            // Get user groups for this user in the given context
            $userGroups = $userGroupDao->getByUserId($userId, $contextId);

            // Convert DAOResultFactory to array and check for Premium group
            foreach ($userGroups as $userGroup) {
                // Get the primary locale for this context
                $contextPrimaryLocale = $this->getJournalPrimaryLocale($contextId);
                if ($userGroup->getData('name', $contextPrimaryLocale) === self::PREMIUM_GROUP_NAME) {
                    return true;
                }
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Handle template display hook for injecting CSS and JavaScript
     *
     * Injects premium submission helper assets into submission workflow pages
     * and provides premium status information to the frontend.
     *
     * @param string $hookName The hook name
     * @param array $args The hook arguments
     *
     * @return bool Always returns false to allow other plugins to process
     */
    public function handleTemplateDisplay(string $hookName, array $args): bool
    {
        $request = Application::get()->getRequest();
        $templateManager = $args[0];
        $requestPath = $request->getRequestPath();

        // Only inject on submission workflow pages
        if (!$this->isSubmissionWorkflowPage($requestPath)) {
            return false;
        }

        $this->injectAssets($templateManager, $request);
        $this->injectPluginData($templateManager, $request);

        return false;
    }

    /**
     * Check if current page is part of submission workflow
     *
     * @param string $requestPath Current request path
     *
     * @return bool True if this is a submission workflow page
     */
    private function isSubmissionWorkflowPage(string $requestPath): bool
    {
        return strpos($requestPath, 'submission') !== false;
    }

    /**
     * Inject CSS and JavaScript assets
     *
     * @param object $templateManager Template manager instance
     * @param object $request Request instance
     */
    private function injectAssets($templateManager, $request): void
    {
        $baseUrl = $request->getBaseUrl();
        $pluginPath = '/plugins/generic/premiumSubmissionHelper';

        // Add CSS
        $templateManager->addStyleSheet(
            'premiumSubmissionHelper',
            $baseUrl . $pluginPath . '/css/premiumSubmissionHelper.css',
            ['contexts' => 'backend']
        );

        // Add JavaScript
        $templateManager->addJavaScript(
            'premiumSubmissionHelper',
            $baseUrl . $pluginPath . '/js/premiumSubmissionHelper.js',
            ['contexts' => 'backend']
        );
    }

    /**
     * Inject plugin configuration data for JavaScript
     *
     * @param object $templateManager Template manager instance
     * @param object $request Request instance
     */
    private function injectPluginData($templateManager, $request): void
    {
        $context = $request->getContext();
        $contextId = $context?->getId() ?? 0;

        $pluginData = [
            'pluginUrl' => $request->getBaseUrl() . '/plugins/generic/premiumSubmissionHelper/',
            'contextId' => $contextId,
            'apiUrl' => $request->getDispatcher()->url(
                $request,
                Application::ROUTE_API,
                $context?->getPath() ?? '',
                'ai-analysis'
            ),
            'locale' => Locale::getLocale(),
            'isPremium' => $this->isUserPremium($contextId),
        ];

        $templateManager->addJavaScript(
            'premiumSubmissionHelperData',
            '$.pkp.plugins.generic = $.pkp.plugins.generic || {};' .
                '$.pkp.plugins.generic.premiumSubmissionHelper = ' . json_encode($pluginData) . ';',
            [
                'inline' => true,
                'contexts' => 'backend',
            ]
        );
    }

    /**
     * @copydoc Plugin::getActions()
     */
    public function getActions($request, $verb): array
    {
        $router = $request->getRouter();

        $actions = [];

        if ($this->getEnabled()) {
            $actions[] = new LinkAction(
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
            );
        }

        return array_merge($actions, parent::getActions($request, $verb));
    }

    /**
     * @copydoc Plugin::manage()
     */
    public function manage($args, $request): JSONMessage
    {
        $verb = $request->getUserVar('verb');

        if ($verb === 'settings') {
            return new JSONMessage(
                true,
                '<p>' . __('plugins.generic.premiumSubmissionHelper.settings.description') . '</p>'
            );
        }

        return parent::manage($args, $request);
    }
}
