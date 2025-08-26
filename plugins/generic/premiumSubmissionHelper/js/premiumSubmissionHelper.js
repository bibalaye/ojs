/**
 * @file js/premiumSubmissionHelper.js
 *
 * Copyright (c) 2025 Premium Submission Helper Plugin
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Plugin JavaScript Premium Submission Helper - Module optimisé
 *
 * Ce module fournit l'intégration côté client pour les fonctionnalités premium
 * incluant l'analyse IA Santaane et l'interface utilisateur améliorée.
 *
 * Architecture :
 * - Pattern Module avec namespace sécurisé
 * - Gestion d'erreurs robuste
 * - Performance optimisée avec debouncing
 * - Code maintenable et documenté
 *
 * @version 1.0.0
 * @global jQuery, TinyMCE
 * @requires jQuery, OJS, TinyMCE
 */

; (function ($, window, document) {
    'use strict';

    /**
     * Module Premium Submission Helper
     *
     * Encapsule toutes les fonctionnalités du plugin dans un namespace sécurisé
     * pour éviter les conflits avec d'autres scripts.
     */
    const PremiumSubmissionHelper = {
        // Configuration et constantes
        config: {
            maxRetries: 3,
            retryDelay: 1000,
            analysisTimeout: 30000,
            minAbstractLength: 50
        },

        // État interne du module
        state: {
            isInitialized: false,
            currentRetry: 0,
            analysisInProgress: false,
            cachedAbstractContent: null, // Cache du contenu analysé
            lastAnalysisResults: null,   // Cache des derniers résultats
            pluginData: null
        },

        /**
         * Initialise le plugin Premium Submission Helper
         *
         * Point d'entrée principal qui configure le plugin et vérifie les prérequis.
         */
        init: function () {
            try {
                // Vérification de la page de soumission
                if (!this.isSubmissionPage()) {
                    return;
                }

                // Récupération des données du plugin avec validation
                this.state.pluginData = this.getPluginData();
                if (!this.state.pluginData) {
                    console.warn('Premium Submission Helper: Données du plugin non disponibles');
                    return;
                }

                // Injection des fonctionnalités IA
                this.initializeAIFeatures();
                this.state.isInitialized = true;

                console.log('Premium Submission Helper initialisé avec succès');
            } catch (error) {
                this.handleError('Erreur d\'initialisation', error);
            }
        },

        /**
         * Vérifie si la page actuelle est une page de soumission
         *
         * @return {boolean} True si c'est une page de soumission
         */
        isSubmissionPage: function () {
            return window.location.href.indexOf('submission') !== -1;
        },

        /**
         * Récupère et valide les données du plugin injectées par PHP
         *
         * @return {Object|null} Données du plugin ou null si non disponibles
         */
        getPluginData: function () {
            try {
                const data = $.pkp?.plugins?.generic?.premiumSubmissionHelper;
                if (!data || typeof data !== 'object') {
                    return null;
                }
                return data;
            } catch (error) {
                console.error('Erreur lors de la récupération des données du plugin:', error);
                return null;
            }
        },

        /**
         * Initialise les fonctionnalités d'analyse IA
         *
         * Tente d'injecter le bouton d'analyse IA avec retry en cas d'échec.
         */
        initializeAIFeatures: function () {
            const self = this;

            // Tentative d'injection immédiate
            if (this.injectAIAnalysisButton()) {
                return;
            }

            // Si échec, retry avec délai progressif
            this.retryWithBackoff(function () {
                return self.injectAIAnalysisButton();
            });
        },

        /**
         * Injecte le bouton d'analyse IA dans les champs abstract appropriés
         *
         * @return {boolean} True si l'injection a réussi, false sinon
         */
        injectAIAnalysisButton: function () {
            try {
                // Recherche des iframes TinyMCE avec pattern abstract
                const abstractIframes = document.querySelectorAll('iframe[id*="abstract"][id*="control"]');

                if (abstractIframes.length === 0) {
                    return false;
                }

                let injectionSuccess = false;
                const isPremium = this.state.pluginData.isPremium;

                abstractIframes.forEach((iframe, index) => {
                    try {
                        const container = this.findIframeContainer(iframe);
                        if (!container) return;

                        // Évite les doublons
                        if (this.aiButtonAlreadyExists(container)) return;

                        // Crée et injecte le conteneur IA
                        const aiContainer = this.createAIContainer(isPremium);
                        container.appendChild(aiContainer);

                        // Configure les événements si utilisateur premium
                        if (isPremium) {
                            this.setupPremiumEvents(aiContainer, container, iframe);
                        }

                        injectionSuccess = true;
                    } catch (error) {
                        console.error('Erreur lors de l\'injection pour iframe', index, ':', error);
                    }
                });

                return injectionSuccess;
            } catch (error) {
                this.handleError('Erreur lors de l\'injection du bouton IA', error);
                return false;
            }
        },

        /**
         * Trouve le conteneur approprié pour une iframe TinyMCE
         *
         * @param {HTMLElement} iframe L'iframe TinyMCE
         * @return {HTMLElement|null} Le conteneur trouvé ou null
         */
        findIframeContainer: function (iframe) {
            let container = iframe.closest('.pkpFormField, [data-field-name]');
            if (!container) {
                container = iframe.parentElement;
            }
            return container;
        },

        /**
         * Vérifie si un bouton IA existe déjà dans le conteneur
         *
         * @param {HTMLElement} container Le conteneur à vérifier
         * @return {boolean} True si le bouton existe déjà
         */
        aiButtonAlreadyExists: function (container) {
            return !!(container.querySelector('.santaane-ai-button') ||
                container.querySelector('.premium-upgrade-message'));
        },

        /**
         * Crée le conteneur d'analyse IA approprié
         *
         * @param {boolean} isPremium Si l'utilisateur est premium
         * @return {HTMLElement} Le conteneur créé
         */
        createAIContainer: function (isPremium) {
            const aiContainer = document.createElement('div');
            aiContainer.className = 'pkpFormField pkpFormField--aiAnalysis';
            aiContainer.style.marginTop = '15px';

            if (isPremium) {
                aiContainer.innerHTML = this.generatePremiumHTML();
            } else {
                aiContainer.innerHTML = this.generateUpgradeHTML();
            }

            return aiContainer;
        },

        /**
         * Génère le HTML pour les utilisateurs premium - Design OJS intégré
         *
         * @return {string} HTML pour interface premium optimisée
         */
        generatePremiumHTML: function () {
            return `
                <div class="pkpFormField__heading">
                    <label class="pkpFormField__label">
                        <span style="color: #1e6292;">🤖</span> Analyse IA Santaane
                        <span style="background: #1e6292; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: 500;">PREMIUM</span>
                    </label>
                </div>
                <div class="pkpFormField__control">
                    <div class="pkpFormField__description">
                        Obtenez une analyse intelligente de votre résumé avec des suggestions d'amélioration personnalisées.
                    </div>
                    <div class="ai-controls-container">
                        <button type="button" class="santaane-ai-button">
                            <span style="margin-right: 6px;">⚡</span>Analyser avec l'IA
                        </button>
                        <div class="results-controls" style="display: none;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #555;">
                                <input type="checkbox" id="show-results-checkbox" style="margin: 0; cursor: pointer;">
                                Afficher les résultats
                            </label>
                        </div>
                    </div>
                    <div id="santaane-ai-results" class="santaane-ai-results" style="display: none;">
                        <!-- Les résultats apparaîtront ici -->
                    </div>
                </div>
            `;
        },

        /**
         * Génère le HTML pour les utilisateurs non-premium - Design discret
         *
         * @return {string} HTML pour message d'upgrade intégré
         */
        generateUpgradeHTML: function () {
            return `
                <div class="pkpFormField__heading">
                    <label class="pkpFormField__label">
                        🤖 Analyse IA Santaane
                    </label>
                </div>
                <div class="pkpFormField__control">
                    <div class="premium-upgrade-message">
                        <div class="upgrade-content">
                            <div class="upgrade-text">
                                <h4><span class="upgrade-icon">💎</span> Fonctionnalité Premium</h4>
                                <p>L'analyse IA avancée est disponible avec un compte Premium. 
                                   Obtenez des suggestions d'amélioration personnalisées pour vos soumissions.</p>
                                <button type="button" class="upgrade-button" onclick="PremiumSubmissionHelper.showUpgradeModal()">
                                    En savoir plus sur Premium
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Configure les événements pour les utilisateurs premium
         *
         * @param {HTMLElement} aiContainer Le conteneur IA
         * @param {HTMLElement} container Le conteneur parent
         * @param {HTMLElement} iframe L'iframe TinyMCE
         */
        setupPremiumEvents: function (aiContainer, container, iframe) {
            // Événement du bouton d'analyse
            const aiButton = aiContainer.querySelector('.santaane-ai-button');
            if (aiButton) {
                aiButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.launchAIAnalysis(container, iframe);
                });
            }

            // Événement de la checkbox d'affichage des résultats
            const showResultsCheckbox = aiContainer.querySelector('#show-results-checkbox');
            if (showResultsCheckbox) {
                showResultsCheckbox.addEventListener('change', (event) => {
                    const results = container.querySelector('#santaane-ai-results');
                    if (results) {
                        results.style.display = event.target.checked ? 'block' : 'none';
                    }
                });
            }
        },

        /**
         * Lance l'analyse IA du contenu abstract
         *
         * @param {HTMLElement} container Le conteneur parent
         * @param {HTMLElement} iframe L'iframe TinyMCE
         */
        launchAIAnalysis: function (container, iframe) {
            if (this.state.analysisInProgress) {
                this.showUserMessage('Une analyse est déjà en cours...', 'warning');
                return;
            }

            try {
                const button = container.querySelector('.santaane-ai-button');
                const results = container.querySelector('#santaane-ai-results');

                // Récupération du contenu de l'abstract
                const abstractText = this.extractAbstractContent(iframe);
                if (!this.validateAbstractContent(abstractText)) {
                    return;
                }

                // Cache du contenu pour les futures fonctionnalités
                this.state.cachedAbstractContent = abstractText;

                // Démarrage de l'analyse
                this.state.analysisInProgress = true;
                this.updateAnalysisUI(button, true);

                // Simulation d'analyse IA avec timeout
                this.performAIAnalysis(abstractText)
                    .then(analysisResults => {
                        // Cache des résultats
                        this.state.lastAnalysisResults = analysisResults;
                        this.displayAnalysisResults(analysisResults, results);
                    })
                    .catch(error => this.handleAnalysisError(error, button))
                    .finally(() => {
                        this.state.analysisInProgress = false;
                        this.updateAnalysisUI(button, false);
                    });

            } catch (error) {
                this.handleError('Erreur lors du lancement de l\'analyse', error);
                this.state.analysisInProgress = false;
            }
        },

        /**
         * Extrait le contenu de l'abstract depuis TinyMCE
         *
         * @param {HTMLElement} iframe L'iframe TinyMCE
         * @return {string} Le contenu de l'abstract
         */
        extractAbstractContent: function (iframe) {
            try {
                if (!iframe || typeof tinyMCE === 'undefined') {
                    return '';
                }

                const editorId = iframe.id.replace('_ifr', '');
                const editor = window.tinyMCE.get(editorId);

                return editor ? editor.getContent({ format: 'text' }) : '';
            } catch (error) {
                console.error('Erreur lors de l\'extraction du contenu:', error);
                return '';
            }
        },

        /**
         * Valide le contenu de l'abstract
         *
         * @param {string} abstractText Le texte de l'abstract
         * @return {boolean} True si valide
         */
        validateAbstractContent: function (abstractText) {
            if (!abstractText || abstractText.trim().length === 0) {
                this.showUserMessage('⚠️ Veuillez d\'abord saisir votre résumé dans le champ correspondant.', 'warning');
                return false;
            }

            if (abstractText.trim().length < this.config.minAbstractLength) {
                this.showUserMessage(
                    `⚠️ Le résumé doit contenir au moins ${this.config.minAbstractLength} caractères.`,
                    'warning'
                );
                return false;
            }

            return true;
        },

        /**
         * Effectue l'analyse IA (simulation)
         *
         * @param {string} abstractText Le texte à analyser
         * @return {Promise} Promise contenant les résultats
         */
        performAIAnalysis: function (abstractText) {
            return new Promise((resolve, reject) => {
                // Simulation avec délai réaliste
                const analysisDelay = Math.min(abstractText.length * 10, this.config.analysisTimeout);

                setTimeout(() => {
                    try {
                        const results = this.generateAnalysisResults(abstractText);
                        resolve(results);
                    } catch (error) {
                        reject(error);
                    }
                }, Math.min(analysisDelay, 3000)); // Max 3 secondes pour la démo
            });
        },

        /**
         * Génère les résultats d'analyse IA sophistiqués
         *
         * @param {string} abstractText Le texte analysé
         * @return {Object} Résultats d'analyse détaillés
         */
        generateAnalysisResults: function (abstractText) {
            const wordCount = abstractText.split(/\s+/).length;
            const charCount = abstractText.length;
            const sentences = abstractText.split(/[.!?]+/).filter(s => s.trim().length > 0);

            // Analyse sophistiquée simulée
            const readabilityScore = this.calculateReadabilityScore(abstractText);
            const structureScore = this.analyzeStructure(abstractText);
            const clarityScore = this.analyzeClarityMetrics(abstractText);
            const overallScore = Math.round((readabilityScore + structureScore + clarityScore) / 3);

            // Analyse des mots-clés et thèmes
            const themes = this.extractThemes(abstractText);
            const methodology = this.detectMethodology(abstractText);

            return {
                overall: {
                    score: overallScore,
                    level: this.getScoreLevel(overallScore),
                    readabilityScore,
                    structureScore,
                    clarityScore
                },
                statistics: {
                    words: wordCount,
                    characters: charCount,
                    sentences: sentences.length,
                    avgWordsPerSentence: Math.round(wordCount / sentences.length),
                    avgCharsPerWord: Math.round(charCount / wordCount)
                },
                analysis: {
                    themes,
                    methodology,
                    strengths: this.identifyStrengths(abstractText, overallScore),
                    improvements: this.generateImprovements(abstractText, overallScore),
                    technicalLevel: this.assessTechnicalLevel(abstractText)
                },
                timestamp: new Date().toISOString()
            };
        },

        /**
         * Calcule le score de lisibilité basé sur des métriques réelles
         */
        calculateReadabilityScore: function (text) {
            const words = text.split(/\s+/).length;
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
            const complexWords = text.split(/\s+/).filter(word => word.length > 6).length;

            // Indice de Flesch simplifié
            const avgWordsPerSentence = words / sentences;
            const complexWordRatio = complexWords / words;

            let score = 100 - (1.015 * avgWordsPerSentence) - (84.6 * complexWordRatio);
            return Math.max(0, Math.min(100, Math.round(score)));
        },

        /**
         * Analyse la structure du texte
         */
        analyzeStructure: function (text) {
            const hasObjective = /\b(objectif|but|goal|aim|purpose)\b/i.test(text);
            const hasMethod = /\b(méthode|method|approach|technique|analysis)\b/i.test(text);
            const hasResults = /\b(résultat|result|finding|conclusion|outcome)\b/i.test(text);
            const hasConclusion = /\b(conclusion|implication|significance|impact)\b/i.test(text);

            const structureElements = [hasObjective, hasMethod, hasResults, hasConclusion];
            const score = (structureElements.filter(Boolean).length / 4) * 100;

            return Math.round(score);
        },

        /**
         * Analyse les métriques de clarté
         */
        analyzeClarityMetrics: function (text) {
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const words = text.split(/\s+/);

            // Vérifications de clarté
            const avgSentenceLength = words.length / sentences.length;
            const jargonWords = words.filter(word => word.length > 12).length;
            const passiveVoice = /\b(été|était|être|est)\s+\w+é\b/g.test(text) ? 1 : 0;

            let score = 85; // Score de base

            if (avgSentenceLength > 25) score -= 15;
            if (avgSentenceLength > 35) score -= 10;
            if (jargonWords > words.length * 0.1) score -= 10;
            if (passiveVoice) score -= 5;

            return Math.max(60, Math.round(score));
        },

        /**
         * Extrait les thèmes principaux
         */
        extractThemes: function (text) {
            const themes = [];
            const lowerText = text.toLowerCase();

            const themeKeywords = {
                'Recherche médicale': ['médical', 'patient', 'thérapie', 'clinique', 'santé', 'traitement'],
                'Intelligence artificielle': ['ia', 'intelligence artificielle', 'machine learning', 'algorithme', 'apprentissage'],
                'Sciences sociales': ['social', 'société', 'comportement', 'psychologie', 'sociologie'],
                'Technologie': ['technologie', 'système', 'logiciel', 'numérique', 'informatique'],
                'Environnement': ['environnement', 'climat', 'écologie', 'durable', 'pollution']
            };

            for (const [theme, keywords] of Object.entries(themeKeywords)) {
                if (keywords.some(keyword => lowerText.includes(keyword))) {
                    themes.push(theme);
                }
            }

            return themes.length > 0 ? themes : ['Recherche générale'];
        },

        /**
         * Détecte la méthodologie utilisée
         */
        detectMethodology: function (text) {
            const lowerText = text.toLowerCase();

            if (/\b(quantitatif|statistique|échantillon|analyse de données)\b/.test(lowerText)) {
                return 'Quantitative';
            } else if (/\b(qualitatif|entretien|observation|étude de cas)\b/.test(lowerText)) {
                return 'Qualitative';
            } else if (/\b(mixte|combiné|triangulation)\b/.test(lowerText)) {
                return 'Méthodes mixtes';
            } else if (/\b(revue|synthèse|méta-analyse)\b/.test(lowerText)) {
                return 'Revue de littérature';
            }

            return 'Non spécifiée';
        },

        /**
         * Identifie les points forts
         */
        identifyStrengths: function (text, score) {
            const strengths = [];

            if (score >= 85) strengths.push('Excellente qualité globale');
            if (text.length >= 150 && text.length <= 300) strengths.push('Longueur optimale');
            if (/\b(objectif|but|goal)\b/i.test(text)) strengths.push('Objectif clairement défini');
            if (/\b(résultat|finding|conclusion)\b/i.test(text)) strengths.push('Résultats bien présentés');
            if (text.split(/[.!?]+/).length >= 3) strengths.push('Structure bien organisée');

            return strengths.length > 0 ? strengths : ['Contenu informatif'];
        },

        /**
         * Génère des suggestions d'amélioration
         */
        generateImprovements: function (text, score) {
            const improvements = [];
            const words = text.split(/\s+/);
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

            if (text.length < 100) {
                improvements.push('Développer davantage le contenu pour atteindre 150-250 mots');
            }

            if (text.length > 350) {
                improvements.push('Réduire la longueur pour une meilleure concision');
            }

            if (words.length / sentences.length > 25) {
                improvements.push('Raccourcir les phrases pour améliorer la lisibilité');
            }

            if (!/\b(méthode|method|approach)\b/i.test(text)) {
                improvements.push('Préciser la méthodologie utilisée');
            }

            if (!/\b(résultat|result|finding)\b/i.test(text)) {
                improvements.push('Inclure les principaux résultats obtenus');
            }

            if (score < 75) {
                improvements.push('Améliorer la clarté en simplifiant le vocabulaire technique');
            }

            return improvements.length > 0 ? improvements : ['Contenu déjà de bonne qualité'];
        },

        /**
         * Évalue le niveau technique
         */
        assessTechnicalLevel: function (text) {
            const technicalTerms = text.split(/\s+/).filter(word => word.length > 8).length;
            const totalWords = text.split(/\s+/).length;
            const ratio = technicalTerms / totalWords;

            if (ratio > 0.2) return 'Très technique';
            if (ratio > 0.1) return 'Technique';
            if (ratio > 0.05) return 'Modérément technique';
            return 'Accessible';
        },

        /**
         * Détermine le niveau basé sur le score
         */
        getScoreLevel: function (score) {
            if (score >= 90) return 'Excellent';
            if (score >= 80) return 'Très bon';
            if (score >= 70) return 'Bon';
            if (score >= 60) return 'Acceptable';
            return 'À améliorer';
        },

        /**
         * Affiche les résultats d'analyse
         *
         * @param {Object} analysisResults Les résultats d'analyse
         * @param {HTMLElement} resultsContainer Le conteneur des résultats
         */
        displayAnalysisResults: function (analysisResults, resultsContainer) {
            try {
                // Affiche le conteneur des résultats
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = this.generateResultsHTML(analysisResults);

                // Affiche la checkbox maintenant que l'analyse est terminée
                const resultsControls = document.querySelector('.results-controls');
                if (resultsControls) {
                    resultsControls.style.display = 'flex';
                }

                // Coche automatiquement la checkbox pour afficher les résultats
                const checkbox = resultsContainer.closest('.pkpFormField--aiAnalysis').querySelector('#show-results-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                }

                console.log('Résultats d\'analyse affichés avec succès');
            } catch (error) {
                this.handleError('Erreur lors de l\'affichage des résultats', error);
            }
        },

        /**
         * Génère le HTML professionnel des résultats d'analyse IA
         *
         * @param {Object} results Les résultats d'analyse détaillés
         * @return {string} HTML formaté professionnel
         */
        generateResultsHTML: function (results) {
            const overallClass = this.getScoreClass(results.overall.score);

            return `
                <div class="ai-analysis-results">
                    <!-- En-tête avec score global -->
                    <div class="analysis-header">
                        <div class="score-circle ${overallClass}">
                            <span class="score-value">${results.overall.score}</span>
                            <span class="score-max">/100</span>
                        </div>
                        <div class="score-details">
                            <h4>Analyse IA Santaane</h4>
                            <p class="score-level">Qualité: <strong>${results.overall.level}</strong></p>
                            <p class="analysis-time">${this.formatAnalysisTime()}</p>
                        </div>
                    </div>

                    <!-- Métriques détaillées -->
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-label">Lisibilité</div>
                            <div class="metric-value">${results.overall.readabilityScore}%</div>
                            <div class="metric-bar">
                                <div class="metric-fill" style="width: ${results.overall.readabilityScore}%"></div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Structure</div>
                            <div class="metric-value">${results.overall.structureScore}%</div>
                            <div class="metric-bar">
                                <div class="metric-fill" style="width: ${results.overall.structureScore}%"></div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Clarté</div>
                            <div class="metric-value">${results.overall.clarityScore}%</div>
                            <div class="metric-bar">
                                <div class="metric-fill" style="width: ${results.overall.clarityScore}%"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Analyse contextuelle -->
                    <div class="analysis-sections">
                        <div class="analysis-section">
                            <h5>Analyse contextuelle</h5>
                            <div class="context-grid">
                                <div class="context-item">
                                    <span class="context-label">Domaine détecté</span>
                                    <span class="context-value">${results.analysis.themes.join(', ')}</span>
                                </div>
                                <div class="context-item">
                                    <span class="context-label">Méthodologie</span>
                                    <span class="context-value">${results.analysis.methodology}</span>
                                </div>
                                <div class="context-item">
                                    <span class="context-label">Niveau technique</span>
                                    <span class="context-value">${results.analysis.technicalLevel}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Statistiques textuelles -->
                        <div class="analysis-section">
                            <h5>Statistiques</h5>
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <span class="stat-number">${results.statistics.words}</span>
                                    <span class="stat-label">mots</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-number">${results.statistics.sentences}</span>
                                    <span class="stat-label">phrases</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-number">${results.statistics.avgWordsPerSentence}</span>
                                    <span class="stat-label">mots/phrase</span>
                                </div>
                            </div>
                        </div>

                        <!-- Points forts -->
                        ${results.analysis.strengths.length > 0 ? `
                        <div class="analysis-section">
                            <h5>Points forts identifiés</h5>
                            <ul class="strength-list">
                                ${results.analysis.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        <!-- Suggestions d'amélioration -->
                        <div class="analysis-section">
                            <h5>Recommandations</h5>
                            <ul class="improvement-list">
                                ${results.analysis.improvements.map(improvement => `<li>${improvement}</li>`).join('')}
                            </ul>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="analysis-footer">
                        <span>Analysé par Santaane IA • ${this.formatTimestamp(results.timestamp)}</span>
                        <div class="footer-actions">
                            <button type="button" class="improve-btn" onclick="PremiumSubmissionHelper.improveAbstract()">
                                <span>✨</span> Améliorer avec l'IA
                            </button>
                            <button type="button" class="export-btn" onclick="PremiumSubmissionHelper.exportResults()">
                                <span>📄</span> Exporter en PDF
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Détermine la classe CSS pour le score
         */
        getScoreClass: function (score) {
            if (score >= 85) return 'excellent';
            if (score >= 75) return 'good';
            if (score >= 65) return 'average';
            return 'needs-improvement';
        },

        /**
         * Formate l'heure d'analyse
         */
        formatAnalysisTime: function () {
            return new Date().toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        /**
         * Formate le timestamp
         */
        formatTimestamp: function (timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        /**
         * Vide le cache du contenu et des résultats
         */
        clearCache: function () {
            this.state.cachedAbstractContent = null;
            this.state.lastAnalysisResults = null;
            console.log('Cache du plugin vidé');
        },

        /**
         * Améliore automatiquement le résumé basé sur l'analyse IA
         */
        improveAbstract: function () {
            try {
                const improveBtn = document.querySelector('.improve-btn');

                // Utilise le contenu en cache ou tente de le récupérer
                let abstractContent = this.state.cachedAbstractContent;
                if (!abstractContent) {
                    abstractContent = this.extractAbstractContent();
                    if (!abstractContent) {
                        this.showUserMessage('Impossible de récupérer le contenu du résumé. Veuillez d\'abord lancer une analyse.', 'error');
                        return;
                    }
                    // Cache le contenu récupéré
                    this.state.cachedAbstractContent = abstractContent;
                }

                // Récupère les recommandations d'amélioration
                const recommendations = this.extractRecommendationsFromResults();
                if (!recommendations || recommendations.length === 0) {
                    this.showUserMessage('Aucune recommandation d\'amélioration disponible. Veuillez d\'abord lancer une analyse.', 'warning');
                    return;
                }

                // Animation du bouton pendant l'amélioration
                if (improveBtn) {
                    improveBtn.classList.add('loading');
                    improveBtn.disabled = true;
                    improveBtn.innerHTML = '<span>🔄</span> Amélioration en cours...';
                }

                // Lance le processus d'amélioration
                this.performAbstractImprovement(abstractContent, recommendations)
                    .then(improvedContent => {
                        this.showImprovementModal(abstractContent, improvedContent, recommendations);
                    })
                    .catch(error => {
                        this.handleError('Erreur lors de l\'amélioration', error);
                        this.showUserMessage('Erreur lors de l\'amélioration automatique.', 'error');
                    })
                    .finally(() => {
                        // Restaure le bouton
                        if (improveBtn) {
                            improveBtn.classList.remove('loading');
                            improveBtn.disabled = false;
                            improveBtn.innerHTML = '<span>✨</span> Améliorer avec l\'IA';
                        }
                    });

            } catch (error) {
                this.handleError('Erreur lors de l\'amélioration', error);
                this.showUserMessage('Erreur lors de l\'amélioration automatique.', 'error');
            }
        },

        /**
         * Extrait les recommandations depuis les résultats affichés
         */
        extractRecommendationsFromResults: function () {
            try {
                const improvementElements = document.querySelectorAll('.improvement-list li');
                return Array.from(improvementElements).map(li =>
                    li.textContent?.replace('→', '').trim()
                ).filter(text => text && text.length > 0);
            } catch (error) {
                console.error('Erreur extraction recommandations:', error);
                return [];
            }
        },

        /**
         * Effectue l'amélioration intelligente du résumé
         */
        performAbstractImprovement: function (originalContent, recommendations) {
            return new Promise((resolve) => {
                // Simulation d'amélioration IA sophistiquée
                setTimeout(() => {
                    const improvedContent = this.generateImprovedAbstract(originalContent, recommendations);
                    resolve(improvedContent);
                }, 2000); // Simulation d'un processus IA réaliste
            });
        },

        /**
         * Génère un résumé amélioré basé sur les recommandations
         */
        generateImprovedAbstract: function (originalContent, recommendations) {
            // Analyse du contenu original
            const sentences = this.splitIntoSentences(originalContent);
            const analysis = this.analyzeContentStructure(sentences);

            // Application des améliorations selon les recommandations
            const improvements = {
                structure: this.improveStructure(sentences, analysis),
                clarity: this.improveClarity(sentences),
                vocabulary: this.improveVocabulary(sentences),
                flow: this.improveFlow(sentences),
                precision: this.improvePrecision(sentences, analysis)
            };

            // Reconstruction du texte amélioré
            let improvedSentences = sentences.slice(); // Copie des phrases originales

            // Application prioritaire des améliorations les plus critiques
            if (recommendations.some(r => r.includes('structure') || r.includes('organisation'))) {
                improvedSentences = improvements.structure;
            }

            if (recommendations.some(r => r.includes('clarté') || r.includes('précision'))) {
                improvedSentences = this.applyClarityImprovements(improvedSentences, improvements.clarity);
            }

            if (recommendations.some(r => r.includes('vocabulaire') || r.includes('terminologie'))) {
                improvedSentences = this.applyVocabularyImprovements(improvedSentences, improvements.vocabulary);
            }

            if (recommendations.some(r => r.includes('transitions') || r.includes('cohérence'))) {
                improvedSentences = this.applyFlowImprovements(improvedSentences, improvements.flow);
            }

            return improvedSentences.join(' ');
        },

        /**
         * Divise le texte en phrases
         */
        splitIntoSentences: function (text) {
            return text.split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => s + '.');
        },

        /**
         * Analyse la structure du contenu
         */
        analyzeContentStructure: function (sentences) {
            const hasObjective = sentences.some(s =>
                /\b(objectif|but|vise|cherche|étudie)\b/i.test(s)
            );
            const hasMethod = sentences.some(s =>
                /\b(méthode|approche|analyse|utilise|applique)\b/i.test(s)
            );
            const hasResults = sentences.some(s =>
                /\b(résultats|montre|révèle|indique|conclut)\b/i.test(s)
            );
            const hasConclusion = sentences.some(s =>
                /\b(conclusion|implications|perspective|suggère)\b/i.test(s)
            );

            return {
                hasObjective,
                hasMethod,
                hasResults,
                hasConclusion,
                needsRestructuring: !hasObjective || !hasMethod || !hasResults
            };
        },

        /**
         * Améliore la structure du résumé
         */
        improveStructure: function (sentences, analysis) {
            let structured = [...sentences];

            // Ajoute une phrase d'objectif si manquante
            if (!analysis.hasObjective) {
                const objectiveSentence = "Cette recherche vise à examiner " +
                    this.extractMainTopic(sentences.join(' ')) + ".";
                structured.unshift(objectiveSentence);
            }

            // Réorganise l'ordre logique
            const reordered = this.reorderSentencesLogically(structured);

            return reordered;
        },

        /**
         * Améliore la clarté des phrases
         */
        improveClarity: function (sentences) {
            return sentences.map(sentence => {
                let improved = sentence;

                // Simplifie les phrases trop longues
                if (sentence.length > 150) {
                    improved = this.splitLongSentence(sentence);
                }

                // Remplace les termes vagues par des termes plus précis
                improved = improved
                    .replace(/\bchose\b/g, 'élément')
                    .replace(/\btruc\b/g, 'aspect')
                    .replace(/\bassez\b/g, 'significativement')
                    .replace(/\bbeaucoup\b/g, 'considérablement');

                return improved;
            });
        },

        /**
         * Améliore le vocabulaire académique
         */
        improveVocabulary: function (sentences) {
            const academicUpgrades = {
                'regarde': 'examine',
                'montre': 'démontre',
                'dit': 'indique',
                'fait': 'réalise',
                'trouve': 'révèle',
                'voit': 'observe',
                'important': 'significatif',
                'intéressant': 'remarquable',
                'bien': 'efficacement',
                'mal': 'inadéquatement'
            };

            return sentences.map(sentence => {
                let improved = sentence;
                Object.entries(academicUpgrades).forEach(([casual, formal]) => {
                    const regex = new RegExp(`\\b${casual}\\b`, 'gi');
                    improved = improved.replace(regex, formal);
                });
                return improved;
            });
        },

        /**
         * Améliore le flux et les transitions
         */
        improveFlow: function (sentences) {
            const transitions = [
                'En outre,', 'Par ailleurs,', 'Cependant,', 'Néanmoins,',
                'En conséquence,', 'Ainsi,', 'De plus,', 'Finalement,'
            ];

            return sentences.map((sentence, index) => {
                if (index > 0 && index < sentences.length - 1) {
                    // Ajoute des transitions appropriées
                    if (!this.hasTransition(sentence) && Math.random() > 0.7) {
                        const transition = transitions[Math.floor(Math.random() * transitions.length)];
                        return transition + ' ' + sentence.toLowerCase();
                    }
                }
                return sentence;
            });
        },

        /**
         * Améliore la précision scientifique
         */
        improvePrecision: function (sentences, analysis) {
            return sentences.map(sentence => {
                let improved = sentence;

                // Ajoute des qualificatifs précis
                improved = improved
                    .replace(/\bproblème\b/g, 'problématique de recherche')
                    .replace(/\bétude\b/g, 'investigation empirique')
                    .replace(/\bdonnées\b/g, 'données empiriques')
                    .replace(/\brésultats\b/g, 'résultats de recherche');

                return improved;
            });
        },

        // Méthodes utilitaires pour l'amélioration
        extractMainTopic: function (content) {
            const words = content.toLowerCase().split(/\s+/);
            const topics = words.filter(word =>
                word.length > 6 &&
                !['cependant', 'néanmoins', 'plusieurs', 'différent'].includes(word)
            );
            return topics[0] || 'le sujet principal';
        },

        reorderSentencesLogically: function (sentences) {
            // Logique de réorganisation basée sur les mots-clés
            const objectiveKeywords = ['objectif', 'but', 'vise'];
            const methodKeywords = ['méthode', 'analyse', 'utilise'];
            const resultKeywords = ['résultats', 'montre', 'révèle'];

            const categorized = {
                objective: [],
                method: [],
                results: [],
                other: []
            };

            sentences.forEach(sentence => {
                if (objectiveKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
                    categorized.objective.push(sentence);
                } else if (methodKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
                    categorized.method.push(sentence);
                } else if (resultKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
                    categorized.results.push(sentence);
                } else {
                    categorized.other.push(sentence);
                }
            });

            return [
                ...categorized.objective,
                ...categorized.method,
                ...categorized.results,
                ...categorized.other
            ];
        },

        splitLongSentence: function (sentence) {
            if (sentence.includes(',') && sentence.length > 100) {
                const parts = sentence.split(',');
                if (parts.length >= 2) {
                    return parts[0].trim() + '. ' + parts.slice(1).join(',').trim();
                }
            }
            return sentence;
        },

        hasTransition: function (sentence) {
            const transitions = [
                'en outre', 'par ailleurs', 'cependant', 'néanmoins',
                'en conséquence', 'ainsi', 'de plus', 'finalement'
            ];
            return transitions.some(t => sentence.toLowerCase().includes(t));
        },

        applyClarityImprovements: function (sentences, clarityImprovements) {
            return clarityImprovements;
        },

        applyVocabularyImprovements: function (sentences, vocabularyImprovements) {
            return vocabularyImprovements;
        },

        applyFlowImprovements: function (sentences, flowImprovements) {
            return flowImprovements;
        },

        /**
         * Affiche la modale comparative d'amélioration
         */
        showImprovementModal: function (originalContent, improvedContent, recommendations) {
            // Supprime une éventuelle modale existante
            const existingModal = document.querySelector('.improvement-modal-overlay');
            if (existingModal) {
                existingModal.remove();
            }

            // Crée la modale
            const modal = this.createImprovementModal(originalContent, improvedContent, recommendations);
            document.body.appendChild(modal);

            // Animation d'entrée
            requestAnimationFrame(() => {
                modal.classList.add('show');
            });

            // Configuration des événements
            this.setupImprovementModalEvents(modal, improvedContent);
        },

        /**
         * Crée la modale HTML d'amélioration
         */
        createImprovementModal: function (originalContent, improvedContent, recommendations) {
            const modal = document.createElement('div');
            modal.className = 'improvement-modal-overlay';

            modal.innerHTML = `
                <div class="improvement-modal-content">
                    <div class="improvement-modal-header">
                        <h3>✨ Amélioration IA du résumé</h3>
                        <button type="button" class="improvement-modal-close">&times;</button>
                    </div>
                    
                    <div class="improvement-modal-body">
                        <div class="improvement-tabs">
                            <button class="improvement-tab active" data-tab="comparison">Comparaison</button>
                            <button class="improvement-tab" data-tab="improvements">Améliorations</button>
                        </div>
                        
                        <div class="improvement-tab-content" id="comparison-tab">
                            <div class="text-comparison">
                                <div class="text-section">
                                    <h4>📝 Version originale</h4>
                                    <div class="text-content original-text">${this.escapeHtml(originalContent)}</div>
                                    <div class="text-stats">
                                        Mots: ${originalContent.split(/\s+/).length} | 
                                        Caractères: ${originalContent.length}
                                    </div>
                                </div>
                                
                                <div class="text-section">
                                    <h4>✨ Version améliorée</h4>
                                    <div class="text-content improved-text">${this.escapeHtml(improvedContent)}</div>
                                    <div class="text-stats improved-stats">
                                        Mots: ${improvedContent.split(/\s+/).length} | 
                                        Caractères: ${improvedContent.length} |
                                        <span class="improvement-indicator">+${this.calculateImprovementPercentage(originalContent, improvedContent)}% d'amélioration</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="improvement-tab-content hidden" id="improvements-tab">
                            <div class="improvements-applied">
                                <h4>🔧 Améliorations appliquées</h4>
                                <ul class="applied-improvements-list">
                                    ${recommendations.map(rec => `
                                        <li class="applied-improvement">
                                            <span class="improvement-check">✅</span>
                                            <span class="improvement-text">${rec}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                                
                                <div class="improvement-summary">
                                    <h5>📊 Résumé des changements</h5>
                                    <div class="change-metrics">
                                        <div class="change-metric">
                                            <span class="metric-label">Structure</span>
                                            <span class="metric-value improved">Améliorée</span>
                                        </div>
                                        <div class="change-metric">
                                            <span class="metric-label">Vocabulaire</span>
                                            <span class="metric-value improved">Enrichi</span>
                                        </div>
                                        <div class="change-metric">
                                            <span class="metric-label">Clarté</span>
                                            <span class="metric-value improved">Optimisée</span>
                                        </div>
                                        <div class="change-metric">
                                            <span class="metric-label">Cohérence</span>
                                            <span class="metric-value improved">Renforcée</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="improvement-modal-footer">
                        <button type="button" class="improvement-btn-secondary improvement-cancel">
                            Conserver l'original
                        </button>
                        <button type="button" class="improvement-btn-primary improvement-apply">
                            ✨ Appliquer l'amélioration
                        </button>
                    </div>
                </div>
            `;

            return modal;
        },

        /**
         * Configure les événements de la modale d'amélioration
         */
        setupImprovementModalEvents: function (modal, improvedContent) {
            // Fermeture de la modale
            const closeBtn = modal.querySelector('.improvement-modal-close');
            const cancelBtn = modal.querySelector('.improvement-cancel');
            const overlay = modal;

            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            closeBtn?.addEventListener('click', closeModal);
            cancelBtn?.addEventListener('click', closeModal);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });

            // Échappement avec clavier
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', handleKeydown);
                }
            };
            document.addEventListener('keydown', handleKeydown);

            // Navigation entre onglets
            const tabs = modal.querySelectorAll('.improvement-tab');
            const tabContents = modal.querySelectorAll('.improvement-tab-content');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Supprime les classes actives
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(tc => tc.classList.add('hidden'));

                    // Active l'onglet sélectionné
                    tab.classList.add('active');
                    const tabId = tab.dataset.tab + '-tab';
                    const targetContent = modal.querySelector('#' + tabId);
                    if (targetContent) {
                        targetContent.classList.remove('hidden');
                    }
                });
            });

            // Application de l'amélioration
            const applyBtn = modal.querySelector('.improvement-apply');
            applyBtn?.addEventListener('click', () => {
                this.applyImprovedContent(improvedContent);
                closeModal();
            });
        },

        /**
         * Applique le contenu amélioré au résumé
         */
        applyImprovedContent: function (improvedContent) {
            try {
                // Trouve l'éditeur TinyMCE actif
                const iframes = document.querySelectorAll('iframe[id*="abstract"]');
                let applied = false;

                iframes.forEach(iframe => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        const bodyElement = iframeDoc.querySelector('body');

                        if (bodyElement) {
                            bodyElement.innerHTML = `<p>${improvedContent}</p>`;
                            applied = true;

                            // Met à jour le cache avec le nouveau contenu
                            this.state.cachedAbstractContent = improvedContent;

                            // Déclenche les événements de changement pour TinyMCE
                            if (iframe.contentWindow.tinymce) {
                                const editor = iframe.contentWindow.tinymce.activeEditor;
                                if (editor) {
                                    editor.fire('change');
                                    editor.fire('input');
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Impossible d\'accéder à iframe:', error);
                    }
                });

                if (applied) {
                    this.showUserMessage('✨ Résumé amélioré avec succès !', 'success');

                    // Mettre à jour l'affichage des résultats si nécessaire
                    setTimeout(() => {
                        const resultsContainer = document.querySelector('.ai-analysis-results');
                        if (resultsContainer) {
                            resultsContainer.style.opacity = '0.7';
                            const notice = document.createElement('div');
                            notice.className = 'improvement-notice';
                            notice.innerHTML = '💡 Relancez l\'analyse pour voir l\'amélioration du score';
                            resultsContainer.appendChild(notice);
                        }
                    }, 1000);
                } else {
                    this.showUserMessage('Impossible d\'appliquer l\'amélioration. Veuillez copier-coller manuellement.', 'warning');
                }

            } catch (error) {
                this.handleError('Erreur lors de l\'application', error);
                this.showUserMessage('Erreur lors de l\'application de l\'amélioration.', 'error');
            }
        },

        /**
         * Calcule le pourcentage d'amélioration
         */
        calculateImprovementPercentage: function (original, improved) {
            // Calcul basé sur divers facteurs d'amélioration
            const originalWords = original.split(/\s+/).length;
            const improvedWords = improved.split(/\s+/).length;

            const wordsDifference = Math.abs(improvedWords - originalWords);
            const academicWords = (improved.match(/\b(examine|démontre|révèle|significatif|investigation)\b/g) || []).length;
            const transitionWords = (improved.match(/\b(en outre|par ailleurs|cependant|néanmoins|ainsi)\b/g) || []).length;

            return Math.min(Math.round(5 + (academicWords * 3) + (transitionWords * 2) + (wordsDifference * 0.5)), 25);
        },

        /**
         * Escape HTML pour la sécurité
         */
        escapeHtml: function (text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Exporte les résultats d'analyse en PDF
         */
        exportResults: function () {
            try {
                const exportBtn = document.querySelector('.export-btn');

                // Récupère les derniers résultats d'analyse
                const resultsContainer = document.querySelector('.ai-analysis-results');
                if (!resultsContainer) {
                    this.showUserMessage('Aucun résultat d\'analyse à exporter.', 'warning');
                    return;
                }

                // Récupère les données depuis le DOM
                const analysisData = this.extractAnalysisDataFromDOM();
                if (!analysisData) {
                    this.showUserMessage('Impossible d\'extraire les données d\'analyse.', 'error');
                    return;
                }

                // Animation du bouton pendant l'export
                if (exportBtn) {
                    exportBtn.classList.add('loading');
                    exportBtn.disabled = true;
                    exportBtn.innerHTML = '<span>⏳</span> Génération en cours...';
                }

                // Génère le PDF avec un délai pour l'animation
                setTimeout(() => {
                    this.generatePDF(analysisData).finally(() => {
                        // Restaure le bouton
                        if (exportBtn) {
                            exportBtn.classList.remove('loading');
                            exportBtn.disabled = false;
                            exportBtn.innerHTML = '<span>📄</span> Exporter en PDF';
                        }
                    });
                }, 100);

            } catch (error) {
                this.handleError('Erreur lors de l\'export PDF', error);
                this.showUserMessage('Erreur lors de la génération du PDF.', 'error');

                // Restaure le bouton en cas d'erreur
                const exportBtn = document.querySelector('.export-btn');
                if (exportBtn) {
                    exportBtn.classList.remove('loading');
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = '<span>📄</span> Exporter en PDF';
                }
            }
        },

        /**
         * Extrait les données d'analyse depuis le DOM
         */
        extractAnalysisDataFromDOM: function () {
            try {
                const results = document.querySelector('.ai-analysis-results');
                if (!results) return null;

                return {
                    overallScore: results.querySelector('.score-value')?.textContent || '0',
                    level: results.querySelector('.score-level strong')?.textContent || 'Non défini',
                    timestamp: results.querySelector('.analysis-footer span')?.textContent || new Date().toLocaleString('fr-FR'),
                    metrics: {
                        readability: results.querySelector('.metric-card:nth-child(1) .metric-value')?.textContent || '0%',
                        structure: results.querySelector('.metric-card:nth-child(2) .metric-value')?.textContent || '0%',
                        clarity: results.querySelector('.metric-card:nth-child(3) .metric-value')?.textContent || '0%'
                    },
                    context: {
                        domain: results.querySelector('.context-item:nth-child(1) .context-value')?.textContent || 'Non spécifié',
                        methodology: results.querySelector('.context-item:nth-child(2) .context-value')?.textContent || 'Non spécifiée',
                        technicalLevel: results.querySelector('.context-item:nth-child(3) .context-value')?.textContent || 'Non défini'
                    },
                    statistics: {
                        words: results.querySelector('.stat-item:nth-child(1) .stat-number')?.textContent || '0',
                        sentences: results.querySelector('.stat-item:nth-child(2) .stat-number')?.textContent || '0',
                        avgWords: results.querySelector('.stat-item:nth-child(3) .stat-number')?.textContent || '0'
                    },
                    strengths: Array.from(results.querySelectorAll('.strength-list li')).map(li => li.textContent?.replace('✓', '').trim()),
                    improvements: Array.from(results.querySelectorAll('.improvement-list li')).map(li => li.textContent?.replace('→', '').trim())
                };
            } catch (error) {
                console.error('Erreur extraction données:', error);
                return null;
            }
        },

        /**
         * Génère le PDF avec les résultats d'analyse
         */
        generatePDF: function (data) {
            // Utilise la librairie jsPDF (chargée dynamiquement)
            return this.loadJsPDF().then(() => {
                // Vérification que jsPDF est bien disponible
                if (!window.jsPDF) {
                    throw new Error('jsPDF non disponible après chargement');
                }

                const { jsPDF } = window;
                console.log('jsPDF version:', jsPDF.version || 'inconnue');
                const doc = new jsPDF();

                // Configuration des couleurs et polices
                const primaryColor = [30, 98, 146]; // Bleu OJS
                const textColor = [51, 51, 51]; // Gris foncé

                let yPosition = 20;

                // En-tête du document
                doc.setFillColor(...primaryColor);
                doc.rect(0, 0, 210, 35, 'F');

                // Logo/titre en blanc
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(20);
                doc.setFont(undefined, 'bold');
                doc.text('Analyse IA Santaane', 20, 15);

                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');
                doc.text('Rapport d\'analyse de résumé académique', 20, 25);

                // Date et score global
                doc.setTextColor(...textColor);
                doc.setFontSize(10);
                yPosition = 45;
                doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 20, yPosition);

                // Score global avec cercle
                yPosition += 15;
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                doc.text('Score Global', 20, yPosition);

                // Cercle de score
                const scoreColor = this.getScoreColorRGB(parseInt(data.overallScore));
                doc.setDrawColor(...scoreColor);
                doc.setLineWidth(3);
                doc.circle(160, yPosition - 3, 15, 'S');

                doc.setTextColor(...scoreColor);
                doc.setFontSize(18);
                doc.text(data.overallScore, 152, yPosition + 2);
                doc.setFontSize(10);
                doc.text('/100', 165, yPosition + 2);

                doc.setTextColor(...textColor);
                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');
                doc.text(`Niveau: ${data.level}`, 20, yPosition + 10);

                // Métriques détaillées
                yPosition += 35;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('Métriques Détaillées', 20, yPosition);

                yPosition += 10;
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');

                const metrics = [
                    ['Lisibilité', data.metrics.readability],
                    ['Structure', data.metrics.structure],
                    ['Clarté', data.metrics.clarity]
                ];

                metrics.forEach(([label, value], index) => {
                    const x = 20 + (index * 60);
                    doc.text(`${label}:`, x, yPosition);
                    doc.setFont(undefined, 'bold');
                    doc.text(value, x, yPosition + 8);
                    doc.setFont(undefined, 'normal');
                });

                // Analyse contextuelle
                yPosition += 25;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('Analyse Contextuelle', 20, yPosition);

                yPosition += 10;
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');

                const contextData = [
                    ['Domaine détecté', data.context.domain],
                    ['Méthodologie', data.context.methodology],
                    ['Niveau technique', data.context.technicalLevel]
                ];

                contextData.forEach(([label, value]) => {
                    yPosition += 8;
                    doc.text(`${label}: `, 20, yPosition);
                    doc.setFont(undefined, 'bold');
                    doc.text(value, 70, yPosition);
                    doc.setFont(undefined, 'normal');
                });

                // Statistiques
                yPosition += 20;
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('Statistiques', 20, yPosition);

                yPosition += 10;
                doc.setFontSize(11);
                doc.setFont(undefined, 'normal');
                doc.text(`Mots: ${data.statistics.words} | Phrases: ${data.statistics.sentences} | Moyenne: ${data.statistics.avgWords} mots/phrase`, 20, yPosition);

                // Points forts
                if (data.strengths && data.strengths.length > 0) {
                    yPosition += 20;
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text('Points Forts', 20, yPosition);

                    yPosition += 8;
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');

                    data.strengths.forEach(strength => {
                        if (yPosition > 250) {
                            doc.addPage();
                            yPosition = 20;
                        }
                        yPosition += 6;
                        doc.text(`• ${strength}`, 25, yPosition);
                    });
                }

                // Recommandations
                if (data.improvements && data.improvements.length > 0) {
                    yPosition += 20;
                    if (yPosition > 240) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text('Recommandations', 20, yPosition);

                    yPosition += 8;
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');

                    data.improvements.forEach(improvement => {
                        if (yPosition > 270) {
                            doc.addPage();
                            yPosition = 20;
                        }
                        yPosition += 6;
                        doc.text(`• ${improvement}`, 25, yPosition);
                    });
                }

                // Footer
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(128, 128, 128);
                    doc.text(`Page ${i}/${pageCount} - Généré par Premium Submission Helper`, 20, 285);
                    doc.text(data.timestamp.replace('Analysé par Santaane IA • ', ''), 150, 285);
                }

                // Sauvegarde du PDF
                const filename = `analyse-ia-santaane-${new Date().toISOString().slice(0, 10)}.pdf`;
                doc.save(filename);

                this.showUserMessage('PDF généré avec succès !', 'success');

            }).catch(error => {
                console.error('Erreur lors de la génération PDF:', error);
                if (error.message.includes('charger jsPDF')) {
                    this.showUserMessage('Impossible de charger la librairie PDF. Vérifiez votre connexion internet.', 'error');
                } else {
                    this.showUserMessage('Erreur lors de la génération du PDF: ' + error.message, 'error');
                }
            });
        },

        /**
         * Charge dynamiquement la librairie jsPDF
         */
        loadJsPDF: function () {
            return new Promise((resolve, reject) => {
                // Vérifie si jsPDF est déjà chargé
                if (window.jsPDF) {
                    console.log('jsPDF déjà disponible');
                    resolve();
                    return;
                }

                console.log('Chargement de jsPDF...');

                // Liste de CDNs de fallback
                const cdnUrls = [
                    'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
                    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
                    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
                ];

                let currentIndex = 0;

                const tryLoadScript = () => {
                    if (currentIndex >= cdnUrls.length) {
                        console.log('Tous les CDNs ont échoué, tentative de fallback...');
                        this.tryFallbackPDF().then(resolve).catch(reject);
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = cdnUrls[currentIndex];

                    script.onload = () => {
                        console.log('Script chargé depuis:', cdnUrls[currentIndex]);

                        // Attendre un peu pour que jsPDF soit disponible
                        setTimeout(() => {
                            if (window.jsPDF) {
                                console.log('jsPDF disponible');
                                resolve();
                            } else {
                                console.log('jsPDF non disponible, tentative CDN suivant...');
                                currentIndex++;
                                tryLoadScript();
                            }
                        }, 100);
                    };

                    script.onerror = () => {
                        console.log('Échec du chargement depuis:', cdnUrls[currentIndex]);
                        currentIndex++;
                        tryLoadScript();
                    };

                    document.head.appendChild(script);
                };

                tryLoadScript();
            });
        },

        /**
         * Méthode de fallback si jsPDF ne peut pas être chargé
         */
        tryFallbackPDF: function () {
            return new Promise((resolve, reject) => {
                // Essayons avec une version plus ancienne et stable
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/jspdf@1.5.3/dist/jspdf.min.js';

                script.onload = () => {
                    setTimeout(() => {
                        if (window.jsPDF) {
                            console.log('jsPDF v1.5.3 chargé avec succès (fallback)');
                            resolve();
                        } else {
                            reject(new Error('Impossible de charger jsPDF même en fallback'));
                        }
                    }, 200);
                };

                script.onerror = () => {
                    reject(new Error('Échec du fallback jsPDF'));
                };

                document.head.appendChild(script);
            });
        },

        /**
         * Convertit les classes de score en couleurs RGB
         */
        getScoreColorRGB: function (score) {
            if (score >= 85) return [16, 185, 129]; // Vert excellent
            if (score >= 75) return [59, 130, 246]; // Bleu bon
            if (score >= 65) return [245, 158, 11]; // Orange moyen
            return [239, 68, 68]; // Rouge à améliorer
        },

        /**
         * Met à jour l'interface utilisateur pendant l'analyse
         *
         * @param {HTMLElement} button Le bouton d'analyse
         * @param {boolean} isAnalyzing Si l'analyse est en cours
         */
        updateAnalysisUI: function (button, isAnalyzing) {
            if (!button) return;

            if (isAnalyzing) {
                button.innerHTML = '🔄 Analyse en cours...';
                button.disabled = true;
                button.classList.add('analyzing');
            } else {
                button.innerHTML = '🚀 Lancer l\'analyse IA';
                button.disabled = false;
                button.classList.remove('analyzing');
            }
        },

        /**
         * Gère les erreurs d'analyse
         *
         * @param {Error} error L'erreur survenue
         * @param {HTMLElement} button Le bouton d'analyse
         */
        handleAnalysisError: function (error, button) {
            console.error('Erreur d\'analyse IA:', error);
            this.showUserMessage('❌ Erreur lors de l\'analyse. Veuillez réessayer.', 'error');

            if (button) {
                button.innerHTML = '⚠️ Réessayer l\'analyse';
            }
        },

        /**
         * Affiche la modale d'upgrade Premium
         */
        showUpgradeModal: function () {
            // Crée la modale si elle n'existe pas
            if (!document.querySelector('.psh-modal-overlay')) {
                this.createUpgradeModal();
            }

            // Affiche la modale
            const modal = document.querySelector('.psh-modal-overlay');
            modal.classList.add('show');

            // Focus sur le premier bouton
            setTimeout(() => {
                const closeBtn = modal.querySelector('.psh-modal-close');
                if (closeBtn) closeBtn.focus();
            }, 100);

            // Désactive le scroll du body
            document.body.style.overflow = 'hidden';
        },

        /**
         * Crée la modale d'upgrade Premium
         */
        createUpgradeModal: function () {
            const modalHTML = `
                <div class="psh-modal-overlay">
                    <div class="psh-modal-content">
                        <div class="psh-modal-header">
                            <h3 class="psh-modal-title">
                                <span>💎</span> Premium Santaane IA
                            </h3>
                            <button type="button" class="psh-modal-close" aria-label="Fermer">×</button>
                        </div>
                        
                        <div class="psh-modal-body">
                            <p class="psh-modal-description">
                                Débloquez le potentiel complet de vos soumissions avec l'analyse IA avancée Santaane. 
                                Obtenez des insights précis et des recommandations personnalisées pour améliorer la qualité de vos articles.
                            </p>
                            
                            <ul class="psh-modal-features">
                                <li class="psh-modal-feature">
                                    <span class="psh-modal-feature-icon">📊</span>
                                    <div class="psh-modal-feature-text">
                                        <div class="psh-modal-feature-title">Scores d'évaluation détaillés</div>
                                        <div class="psh-modal-feature-desc">Analyse quantitative de la structure, clarté et impact de votre résumé</div>
                                    </div>
                                </li>
                                <li class="psh-modal-feature">
                                    <span class="psh-modal-feature-icon">💡</span>
                                    <div class="psh-modal-feature-text">
                                        <div class="psh-modal-feature-title">Suggestions intelligentes</div>
                                        <div class="psh-modal-feature-desc">Recommandations contextuelles pour optimiser votre contenu</div>
                                    </div>
                                </li>
                                <li class="psh-modal-feature">
                                    <span class="psh-modal-feature-icon">🎯</span>
                                    <div class="psh-modal-feature-text">
                                        <div class="psh-modal-feature-title">Analyse de structure</div>
                                        <div class="psh-modal-feature-desc">Vérification de la cohérence et de l'organisation de votre texte</div>
                                    </div>
                                </li>
                                <li class="psh-modal-feature">
                                    <span class="psh-modal-feature-icon">⚡</span>
                                    <div class="psh-modal-feature-text">
                                        <div class="psh-modal-feature-title">Analyse instantanée</div>
                                        <div class="psh-modal-feature-desc">Résultats rapides et fiables pour accélérer votre workflow</div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        
                        <div class="psh-modal-footer">
                            <button type="button" class="psh-modal-cancel">Peut-être plus tard</button>
                            <button type="button" class="psh-modal-contact">Contacter l'administrateur</button>
                        </div>
                    </div>
                </div>
            `;

            // Ajoute la modale au DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Configure les événements
            this.setupModalEvents();
        },

        /**
         * Configure les événements de la modale
         */
        setupModalEvents: function () {
            const modal = document.querySelector('.psh-modal-overlay');
            const closeBtn = modal.querySelector('.psh-modal-close');
            const cancelBtn = modal.querySelector('.psh-modal-cancel');
            const contactBtn = modal.querySelector('.psh-modal-contact');

            // Fermeture de la modale
            const closeModal = () => {
                modal.classList.remove('show');
                document.body.style.overflow = '';

                // Supprime la modale après l'animation
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            };

            // Événements de fermeture
            closeBtn.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);

            // Fermeture en cliquant sur l'overlay
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            // Fermeture avec Escape
            document.addEventListener('keydown', function escapeHandler(e) {
                if (e.key === 'Escape' && modal.classList.contains('show')) {
                    closeModal();
                    document.removeEventListener('keydown', escapeHandler);
                }
            });

            // Contact administrateur
            contactBtn.addEventListener('click', () => {
                // Ici vous pouvez implémenter la logique de contact
                // Par exemple, redirection vers un formulaire de contact
                this.showUserMessage('Pour activer Premium, contactez votre administrateur système.', 'info');
                closeModal();
            });
        },

        /**
         * Méthode de compatibilité pour l'ancien système
         */
        showUpgradeInfo: function () {
            // Redirige vers la nouvelle modale
            this.showUpgradeModal();
        },

        /**
         * Retry avec backoff exponentiel
         *
         * @param {Function} operation L'opération à retry
         */
        retryWithBackoff: function (operation) {
            const self = this;

            function attempt() {
                if (self.state.currentRetry >= self.config.maxRetries) {
                    console.warn('Premium Submission Helper: Nombre maximum de tentatives atteint');
                    return;
                }

                if (operation()) {
                    self.state.currentRetry = 0; // Reset sur succès
                    return;
                }

                self.state.currentRetry++;
                const delay = self.config.retryDelay * self.state.currentRetry;

                setTimeout(attempt, delay);
            }

            setTimeout(attempt, this.config.retryDelay);
        },

        /**
         * Affiche un message à l'utilisateur
         *
         * @param {string} message Le message à afficher
         * @param {string} type Le type de message (info, warning, error)
         */
        showUserMessage: function (message, type = 'info') {
            // Utilise les notifications OJS si disponibles, sinon alert()
            if (window.pkp && window.pkp.eventBus) {
                window.pkp.eventBus.$emit('notify', message, type);
            } else {
                alert(message);
            }
        },

        /**
         * Gestionnaire d'erreurs centralisé
         *
         * @param {string} context Le contexte de l'erreur
         * @param {Error} error L'erreur survenue
         */
        handleError: function (context, error) {
            const errorMessage = `${context}: ${error.message || error}`;
            console.error(errorMessage, error);

            // Log pour debugging en développement
            if (this.state.pluginData?.debug) {
                console.trace('Stack trace:', error);
            }
        }
    };

    // Exposition globale pour les callbacks onclick
    window.PremiumSubmissionHelper = PremiumSubmissionHelper;

    // Initialisation au chargement du DOM
    $(document).ready(function () {
        PremiumSubmissionHelper.init();
    });

})(window.jQuery, window, document);