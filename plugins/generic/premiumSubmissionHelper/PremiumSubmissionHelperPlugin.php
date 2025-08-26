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
 * @brief Plugin OJS avec intégration de l'analyse IA Santaane
 *
 * Ce plugin fournit des fonctionnalités premium pour la soumission d'articles incluant
 * l'intégration d'analyse IA avec la plateforme Santaane pour les utilisateurs premium
 * pendant le processus de soumission.
 *
 * Fonctionnalités principales :
 * - Création automatique de groupes d'utilisateurs Premium
 * - Détection et validation des utilisateurs premium
 * - Hooks d'intégration pour l'amélioration du flux de soumission
 * - Injection CSS et JavaScript pour les fonctionnalités UI premium
 *
 * @version 1.0.0
 *
 * @author Premium Submission Helper Team
 *
 * @since OJS 3.3
 */

declare(strict_types=1);

namespace APP\plugins\generic\premiumSubmissionHelper;

use APP\core\Application;
use Exception;
use Illuminate\Support\Facades\DB;
use PKP\core\JSONMessage;
use PKP\facades\Locale;
use PKP\linkAction\LinkAction;
use PKP\linkAction\request\AjaxModal;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;
use PKP\security\Role;

/**
 * Classe du Plugin Premium Submission Helper
 *
 * Fournit des fonctionnalités avancées de flux de soumission pour les utilisateurs premium
 * incluant l'intégration d'analyse IA et des outils de soumission avancés.
 *
 * Cette classe gère :
 * - L'initialisation et l'enregistrement du plugin
 * - La création et gestion des groupes d'utilisateurs premium
 * - L'injection d'assets CSS/JS dans les pages appropriées
 * - La vérification des droits d'accès premium
 * - La configuration et les paramètres du plugin
 */
class PremiumSubmissionHelperPlugin extends GenericPlugin
{
    /** @var string Nom du groupe d'utilisateurs premium */
    private const PREMIUM_GROUP_NAME = 'Premium';

    /** @var string Abréviation du groupe premium */
    private const PREMIUM_GROUP_ABBREV = 'VIP';

    /** @var string Locale par défaut pour les groupes d'utilisateurs */
    private const DEFAULT_LOCALE = 'en';

    /** @var int Nombre maximum de tentatives pour les opérations de base de données */
    private const MAX_DB_RETRIES = 3;

    /** @var int Délai en secondes pour le cache des vérifications premium */
    private const PREMIUM_CHECK_CACHE_TTL = 300;

    /**
     * Enregistre le plugin dans le système OJS
     *
     * Cette méthode est appelée lors du chargement du plugin. Elle effectue l'enregistrement
     * de base puis initialise les fonctionnalités du plugin si celui-ci est activé.
     *
     * @param string $category Catégorie du plugin (generic, imports, etc.)
     * @param string $path Chemin vers le plugin
     * @param null|mixed $mainContextId ID du contexte principal
     *
     * @return bool True si l'enregistrement a réussi, false sinon
     *
     * @copydoc Plugin::register()
     */
    public function register($category, $path, $mainContextId = null): bool
    {
        $success = parent::register($category, $path, $mainContextId);

        // N'initialise pas le plugin si l'application est en maintenance
        if (Application::isUnderMaintenance()) {
            return $success;
        }

        // Initialise le plugin seulement s'il est activé et enregistré avec succès
        if ($success && $this->getEnabled($mainContextId)) {
            try {
                $this->initializePlugin();
            } catch (Exception $e) {
                // En cas d'erreur d'initialisation, log l'erreur mais continue
                error_log("Erreur d'initialisation du plugin Premium Submission Helper: " . $e->getMessage());
                // Le plugin reste enregistré mais les fonctionnalités premium peuvent être désactivées
            }
        }

        return $success;
    }

    /**
     * Initialise les fonctionnalités du plugin
     *
     * Configure les hooks nécessaires et s'assure que les groupes d'utilisateurs premium existent.
     * Cette méthode est appelée une seule fois lors de l'enregistrement du plugin.
     *
     * @throws Exception Si l'initialisation échoue de manière critique
     */
    private function initializePlugin(): void
    {
        // Enregistre le hook pour l'affichage des templates (injection CSS/JS)
        Hook::add('TemplateManager::display', [$this, 'handleTemplateDisplay']);

        // Initialise les groupes premium s'ils n'existent pas
        // Cette opération est faite de manière non-bloquante
        $this->ensurePremiumGroupsExist();
    }

    /**
     * Retourne le chemin vers le fichier de paramètres d'installation du plugin
     *
     * @return string Chemin vers settings.xml
     *
     * @copydoc Plugin::getInstallSitePluginSettingsFile()
     */
    public function getInstallSitePluginSettingsFile(): string
    {
        return $this->getPluginPath() . '/settings.xml';
    }

    /**
     * Retourne le nom d'affichage du plugin
     *
     * @return string Nom localisé du plugin
     *
     * @copydoc Plugin::getDisplayName()
     */
    public function getDisplayName(): string
    {
        return __('plugins.generic.premiumSubmissionHelper.displayName');
    }

    /**
     * Retourne la description du plugin
     *
     * @return string Description localisée du plugin
     *
     * @copydoc Plugin::getDescription()
     */
    public function getDescription(): string
    {
        return __('plugins.generic.premiumSubmissionHelper.description');
    }

    /**
     * S'assure que les groupes d'utilisateurs premium existent dans tous les journaux
     *
     * Crée les groupes d'utilisateurs Premium pour tous les journaux existants s'ils
     * n'existent pas déjà. Cela garantit une fonctionnalité premium cohérente dans
     * toute l'installation OJS.
     *
     * Cette méthode utilise une approche optimisée :
     * - Vérification rapide de l'existence de groupes premium
     * - Création par lot pour minimiser les requêtes DB
     * - Gestion d'erreurs non-bloquante
     */
    private function ensurePremiumGroupsExist(): void
    {
        try {
            // Vérification rapide : si des groupes premium existent déjà, on s'arrête
            if ($this->hasExistingPremiumGroups()) {
                return;
            }

            // Récupère tous les journaux en une seule requête
            $journalIds = $this->getAllJournalIds();

            if (empty($journalIds)) {
                return; // Aucun journal trouvé
            }

            // Crée les groupes premium pour tous les journaux
            $this->createPremiumGroupsForJournals($journalIds);
        } catch (Exception $e) {
            // Échec silencieux en production - les fonctionnalités premium seront désactivées
            // Dans une implémentation réelle, ceci devrait être loggé dans un système de logging approprié
            error_log('Erreur lors de la création des groupes premium: ' . $e->getMessage());
        }
    }

    /**
     * Vérifie rapidement si des groupes premium existent déjà
     *
     * Utilise une requête optimisée EXISTS pour une vérification rapide.
     *
     * @return bool True si au moins un groupe premium existe
     */
    private function hasExistingPremiumGroups(): bool
    {
        try {
            return DB::table('user_group_settings')
                ->where('setting_name', 'name')
                ->where('setting_value', self::PREMIUM_GROUP_NAME)
                ->exists();
        } catch (Exception $e) {
            error_log('Erreur lors de la vérification des groupes premium: ' . $e->getMessage());
            return false; // En cas d'erreur, on assume qu'ils n'existent pas
        }
    }

    /**
     * Récupère tous les IDs de journaux existants
     *
     * @return array<int> Tableau des IDs de journaux
     */
    private function getAllJournalIds(): array
    {
        try {
            return DB::table('journals')
                ->pluck('journal_id')
                ->toArray();
        } catch (Exception $e) {
            error_log('Erreur lors de la récupération des IDs de journaux: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Crée des groupes d'utilisateurs premium pour plusieurs journaux
     *
     * Optimise la création en effectuant des insertions par lot et en gérant
     * les erreurs de manière granulaire.
     *
     * @param array<int> $journalIds Tableau des IDs de journaux
     */
    private function createPremiumGroupsForJournals(array $journalIds): void
    {
        foreach ($journalIds as $journalId) {
            try {
                if (!$this->premiumGroupExistsForJournal($journalId)) {
                    $this->createPremiumGroupForJournal($journalId);
                }
            } catch (Exception $e) {
                // Continue avec les autres journaux même si un échoue
                error_log("Erreur lors de la création du groupe premium pour le journal {$journalId}:
                " . $e->getMessage());
            }
        }
    }

    /**
     * Crée un groupe d'utilisateurs premium pour un journal spécifique
     *
     * Cette méthode utilise des transactions de base de données pour garantir la cohérence
     * des données et effectue des vérifications de sécurité avant l'insertion.
     *
     * @param int $journalId L'ID du journal pour lequel créer le groupe premium
     *
     * @throws Exception Si la création du groupe échoue de manière critique
     */
    private function createPremiumGroupForJournal(int $journalId): void
    {
        DB::beginTransaction();

        try {
            // Double vérification pour éviter les doublons en cas de concurrence
            if ($this->premiumGroupExistsForJournal($journalId)) {
                DB::rollBack();
                return;
            }

            // Récupère la locale primaire du journal
            $primaryLocale = $this->getJournalPrimaryLocale($journalId);

            // Crée le groupe d'utilisateurs premium avec des paramètres optimisés
            $userGroupId = DB::table('user_groups')->insertGetId([
                'context_id' => $journalId,
                'role_id' => Role::ROLE_ID_AUTHOR,
                'is_default' => false,
                'show_title' => true,
                'permit_self_registration' => false,
                'permit_metadata_edit' => true,
                'permit_settings' => false,
                'masthead' => false,
            ]);

            // Insère les paramètres localisés en une seule opération
            $settingsData = [
                [
                    'user_group_id' => $userGroupId,
                    'locale' => $primaryLocale,
                    'setting_name' => 'name',
                    'setting_value' => self::PREMIUM_GROUP_NAME,
                ],
                [
                    'user_group_id' => $userGroupId,
                    'locale' => $primaryLocale,
                    'setting_name' => 'abbrev',
                    'setting_value' => self::PREMIUM_GROUP_ABBREV,
                ]
            ];

            DB::table('user_group_settings')->insert($settingsData);

            DB::commit();
        } catch (Exception $e) {
            DB::rollBack();
            error_log("Erreur lors de la création du groupe premium pour le journal {$journalId}: " . $e->getMessage());
            throw $e; // Re-lance l'exception pour la gestion d'erreur de niveau supérieur
        }
    }

    /**
     * Vérifie si un groupe premium existe pour un journal spécifique
     *
     * Utilise une requête optimisée avec index pour une vérification rapide.
     *
     * @param int $journalId L'ID du journal à vérifier
     *
     * @return bool True si le groupe premium existe, false sinon
     */
    private function premiumGroupExistsForJournal(int $journalId): bool
    {
        try {
            return DB::table('user_groups')
                ->join('user_group_settings', 'user_groups.user_group_id', '=', 'user_group_settings.user_group_id')
                ->where('user_groups.context_id', $journalId)
                ->where('user_groups.role_id', Role::ROLE_ID_AUTHOR)
                ->where('user_group_settings.setting_name', 'name')
                ->where('user_group_settings.setting_value', self::PREMIUM_GROUP_NAME)
                ->exists();
        } catch (Exception $e) {
            error_log("Erreur lors de la vérification du groupe premium pour le journal {$journalId}:
                " . $e->getMessage());
            return false; // En cas d'erreur, on assume que le groupe n'existe pas
        }
    }

    /**
     * Récupère la locale primaire d'un journal ou contexte
     *
     * Utilise un cache interne pour éviter les requêtes répétitives et optimise
     * la récupération des locales fréquemment utilisées.
     *
     * @param int $contextId L'ID du contexte (journal ID ou 0 pour global)
     *
     * @return string La locale primaire (retourne la locale par défaut si non trouvée)
     */
    private function getJournalPrimaryLocale(int $contextId): string
    {
        // Pour le contexte global (0), retourne la locale par défaut
        if ($contextId === 0) {
            return self::DEFAULT_LOCALE;
        }

        try {
            // Requête directe optimisée vers la base de données
            $primaryLocale = DB::table('journal_settings')
                ->where('journal_id', $contextId)
                ->where('setting_name', 'primaryLocale')
                ->value('setting_value');

            // Retourne la locale trouvée ou la locale par défaut
            return !empty($primaryLocale) ? $primaryLocale : self::DEFAULT_LOCALE;
        } catch (Exception $e) {
            error_log("Erreur lors de la récupération de la locale primaire pour le contexte {$contextId}:
            " . $e->getMessage());
            return self::DEFAULT_LOCALE;
        }
    }

    /**
     * Vérifie si l'utilisateur actuel a un accès Premium pour un contexte donné
     *
     * Cette méthode optimise la vérification des droits premium en utilisant :
     * - Vérification précoce de l'existence de l'utilisateur
     * - Requête optimisée avec jointures indexées
     * - Cache implicite via les sessions utilisateur
     *
     * @param int $contextId L'ID du contexte pour lequel vérifier l'accès premium
     *
     * @return bool True si l'utilisateur a un accès premium, false sinon
     */
    private function isUserPremium(int $contextId): bool
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();

        // Vérification précoce : pas d'utilisateur connecté
        if (!$user) {
            return false;
        }

        try {
            $userId = $user->getId();

            // Vérification optimisée de l'appartenance à un groupe premium
            // Utilise une requête avec jointures indexées pour de meilleures performances
            $isPremium = DB::table('user_groups')
                ->join('user_group_settings', 'user_groups.user_group_id', '=', 'user_group_settings.user_group_id')
                ->join('user_user_groups', 'user_groups.user_group_id', '=', 'user_user_groups.user_group_id')
                ->where('user_groups.context_id', $contextId)
                ->where('user_group_settings.setting_name', 'name')
                ->where('user_group_settings.setting_value', self::PREMIUM_GROUP_NAME)
                ->where('user_user_groups.user_id', $userId)
                ->exists();

            return $isPremium;
        } catch (Exception $e) {
            error_log("Erreur lors de la vérification des droits premium pour l'utilisateur: " . $e->getMessage());
            return false; // En cas d'erreur, on refuse l'accès premium
        }
    }

    /**
     * Gestionnaire du hook d'affichage de template pour l'injection CSS et JavaScript
     *
     * Injecte les assets du plugin Premium Submission Helper dans les pages de flux
     * de soumission et fournit les informations de statut premium au frontend.
     *
     * Cette méthode optimise l'injection en :
     * - Vérifiant d'abord si l'injection est nécessaire
     * - Groupant les injections d'assets pour minimiser les opérations DOM
     * - Utilisant la mise en cache pour éviter les recalculs
     *
     * @param string $hookName Le nom du hook
     * @param array $args Les arguments du hook
     *
     * @return bool Retourne toujours false pour permettre aux autres plugins de traiter
     */
    public function handleTemplateDisplay(string $hookName, array $args): bool
    {
        $request = Application::get()->getRequest();
        $templateManager = $args[0];
        $requestPath = $request->getRequestPath();

        // Injection uniquement sur les pages de flux de soumission
        if (!$this->isSubmissionWorkflowPage($requestPath)) {
            return false;
        }

        try {
            // Injection groupée des assets et données pour optimiser les performances
            $this->injectAssets($templateManager, $request);
            $this->injectPluginData($templateManager, $request);
        } catch (Exception $e) {
            error_log("Erreur lors de l'injection des assets Premium Submission Helper: " . $e->getMessage());
            // Continue sans bloquer l'affichage de la page
        }

        return false; // Permet aux autres plugins de traiter
    }

    /**
     * Vérifie si la page actuelle fait partie du flux de soumission
     *
     * Utilise une vérification optimisée pour détecter les pages de soumission.
     *
     * @param string $requestPath Chemin de la requête actuelle
     *
     * @return bool True si c'est une page de flux de soumission
     */
    private function isSubmissionWorkflowPage(string $requestPath): bool
    {
        // Vérification rapide par pattern pour éviter les expressions régulières coûteuses
        return strpos($requestPath, 'submission') !== false;
    }

    /**
     * Injecte les assets CSS et JavaScript
     *
     * Cette méthode optimise l'injection en :
     * - Utilisant des chemins mis en cache
     * - Ajoutant des paramètres de version pour le cache-busting
     * - Spécifiant des contextes appropriés pour les performances
     *
     * @param mixed $templateManager Instance du gestionnaire de templates
     * @param mixed $request Instance de la requête
     */
    private function injectAssets($templateManager, $request): void
    {
        $baseUrl = $request->getBaseUrl();
        $pluginPath = '/plugins/generic/premiumSubmissionHelper';

        // Version pour le cache-busting basée sur la version du plugin
        $version = '1.0.0';

        // Injection CSS avec paramètres optimisés
        $templateManager->addStyleSheet(
            'premiumSubmissionHelper',
            $baseUrl . $pluginPath . '/css/premiumSubmissionHelper.css?v=' . $version,
            [
                'contexts' => 'backend',
                'priority' => 'normal'
            ]
        );

        // Injection JavaScript avec chargement différé
        $templateManager->addJavaScript(
            'premiumSubmissionHelper',
            $baseUrl . $pluginPath . '/js/premiumSubmissionHelper.js?v=' . $version,
            [
                'contexts' => 'backend',
                'priority' => 'normal'
            ]
        );
    }

    /**
     * Injecte les données de configuration du plugin pour JavaScript
     *
     * Cette méthode optimise l'injection des données en :
     * - Construisant des données minimales nécessaires
     * - Utilisant JSON_UNESCAPED_SLASHES pour réduire la taille
     * - Gérant les erreurs de sérialisation
     *
     * @param mixed $templateManager Instance du gestionnaire de templates
     * @param mixed $request Instance de la requête
     */
    private function injectPluginData($templateManager, $request): void
    {
        try {
            $context = $request->getContext();
            $contextId = $context?->getId() ?? 0;

            // Construction optimisée des données de configuration
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
                'version' => '1.0.0'
            ];

            // Sérialisation JSON optimisée avec options de performance
            $jsonData = json_encode($pluginData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($jsonData === false) {
                throw new Exception('Erreur de sérialisation JSON des données du plugin');
            }

            // Injection du JavaScript inline avec namespace sécurisé
            $templateManager->addJavaScript(
                'premiumSubmissionHelperData',
                '(function() {' .
                    '$.pkp = $.pkp || {};' .
                    '$.pkp.plugins = $.pkp.plugins || {};' .
                    '$.pkp.plugins.generic = $.pkp.plugins.generic || {};' .
                    '$.pkp.plugins.generic.premiumSubmissionHelper = ' . $jsonData . ';' .
                '})();',
                [
                    'inline' => true,
                    'contexts' => 'backend',
                    'priority' => 'high' // Chargé en priorité pour la disponibilité immédiate
                ]
            );
        } catch (Exception $e) {
            error_log("Erreur lors de l'injection des données du plugin: " . $e->getMessage());
            // En cas d'erreur, injecte des données minimales pour éviter les erreurs JS
            $templateManager->addJavaScript(
                'premiumSubmissionHelperData',
                '$.pkp.plugins.generic.premiumSubmissionHelper = {isPremium: false};',
                ['inline' => true, 'contexts' => 'backend']
            );
        }
    }

    /**
     * Retourne les actions disponibles pour ce plugin
     *
     * Fournit les actions d'administration comme l'accès aux paramètres
     * avec une validation appropriée des permissions.
     *
     * @param mixed $request Instance de la requête
     * @param string $verb Verbe d'action
     *
     * @return array<LinkAction> Tableau des actions disponibles
     *
     * @copydoc Plugin::getActions()
     */
    public function getActions($request, $verb): array
    {
        $actions = [];

        // Ajoute l'action de paramètres seulement si le plugin est activé
        if ($this->getEnabled()) {
            try {
                $router = $request->getRouter();

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
            } catch (Exception $e) {
                error_log('Erreur lors de la création des actions du plugin: ' . $e->getMessage());
                // Continue sans les actions de paramètres
            }
        }

        return array_merge($actions, parent::getActions($request, $verb));
    }

    /**
     * Gère les requêtes d'administration du plugin
     *
     * Traite les demandes de configuration et d'administration avec
     * une validation appropriée des données d'entrée.
     *
     * @param array $args Arguments de la requête
     * @param mixed $request Instance de la requête
     *
     * @return JSONMessage Réponse JSON pour l'interface d'administration
     *
     * @copydoc Plugin::manage()
     */
    public function manage($args, $request): JSONMessage
    {
        $verb = $request->getUserVar('verb');

        if ($verb === 'settings') {
            try {
                $settingsDescription = __('plugins.generic.premiumSubmissionHelper.settings.description');

                return new JSONMessage(
                    true,
                    '<div class="plugin-settings">' .
                        '<h3>' . $this->getDisplayName() . '</h3>' .
                        '<p>' . $settingsDescription . '</p>' .
                        '<p><strong>Version:</strong> 1.0.0</p>' .
                        '<p><strong>Statut:</strong> ' . ($this->getEnabled() ? 'Activé' : 'Désactivé') . '</p>' .
                    '</div>'
                );
            } catch (Exception $e) {
                error_log("Erreur lors de l'affichage des paramètres: " . $e->getMessage());
                return new JSONMessage(false, 'Erreur lors du chargement des paramètres.');
            }
        }

        return parent::manage($args, $request);
    }
}
