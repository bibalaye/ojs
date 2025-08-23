/**
 * @file js/premiumSubmissionHelper.js
 *
 * Copyright (c) 2025 Premium Submission Helper Plugin
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Premium Submission Helper JavaScript plugin
 */

// Wait for OJS to be ready
$(document).ready(function() {
    // Check if we are on a submission page
    if (window.location.href.indexOf('submission') === -1) {
        return;
    }
    
    // Get plugin data
    var pluginData = $.pkp.plugins.generic.premiumSubmissionHelper;
    var isPremium = pluginData && pluginData.isPremium;
    
    // Function to inject AI analysis button
    function injectAIAnalysisButton() {
        // Look for TinyMCE iframe with abstract ID pattern
        var abstractIframes = document.querySelectorAll('iframe[id*="abstract"][id*="control"]');
        
        if (abstractIframes.length === 0) {
            return false;
        }
        
        abstractIframes.forEach(function(iframe, index) {
            // Find the container of this iframe
            var container = iframe.closest('.pkpFormField, [data-field-name]');
            if (!container) {
                container = iframe.parentElement;
            }
            
            // Check if AI button already exists
            if (container.querySelector('.santaane-ai-button') || container.querySelector('.premium-upgrade-message')) {
                return;
            }
            
            // Create AI analysis container
            var aiContainer = document.createElement('div');
            aiContainer.className = 'pkpFormField pkpFormField--aiAnalysis';
            aiContainer.style.marginTop = '15px';
            
            if (isPremium) {
                // Premium user - show the AI analysis button
                aiContainer.innerHTML = 
                    '<div class="pkpFormField__heading">' +
                        '<label class="pkpFormField__label">' +
                            '🤖 Analyse IA Santaane' +
                        '</label>' +
                    '</div>' +
                    '<div class="pkpFormField__control">' +
                        '<div class="pkpFormField__description">' +
                            'Analysez votre resume avec l\'intelligence artificielle Santaane pour obtenir des suggestions d\'amelioration.' +
                        '</div>' +
                        '<div style="margin: 15px 0;">' +
                            '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: #555;">' +
                                '<input type="checkbox" id="show-results-checkbox" style="margin: 0; cursor: pointer;">' +
                                'Afficher les resultats de l\'analyse' +
                            '</label>' +
                        '</div>' +
                        '<button type="button" class="pkpButton pkpButton--primary santaane-ai-button" style="margin-top: 10px;">' +
                            '🚀 Lancer l\'analyse IA' +
                        '</button>' +
                        '<div id="santaane-ai-results" class="santaane-ai-results" style="display: none;">' +
                            '<!-- Les resultats apparaîtront ici -->' +
                        '</div>' +
                    '</div>';
                
                // Insert after the iframe container
                container.appendChild(aiContainer);
                
                // Add event listener to the button
                var aiButton = aiContainer.querySelector('.santaane-ai-button');
                if (aiButton) {
                    aiButton.addEventListener('click', function() {
                        launchAIAnalysis(container, iframe);
                    });
                }
                
                // Add event listener to the checkbox for show/hide results
                var showResultsCheckbox = aiContainer.querySelector('#show-results-checkbox');
                if (showResultsCheckbox) {
                    showResultsCheckbox.addEventListener('change', function() {
                        var results = container.querySelector('#santaane-ai-results');
                        if (results) {
                            if (this.checked) {
                                results.style.display = 'block';
                            } else {
                                results.style.display = 'none';
                            }
                        }
                    });
                }
            } else {
                // Non-premium user - show upgrade message
                aiContainer.innerHTML = 
                    '<div class="pkpFormField__heading">' +
                        '<label class="pkpFormField__label">' +
                            '🤖 Analyse IA Santaane' +
                        '</label>' +
                    '</div>' +
                    '<div class="pkpFormField__control">' +
                        '<div class="premium-upgrade-message">' +
                            '<div class="upgrade-icon">⭐</div>' +
                            '<div class="upgrade-content">' +
                                '<h4>Fonctionnalité Premium</h4>' +
                                '<p>Accédez à l\'analyse IA Santaane pour améliorer vos soumissions avec des suggestions intelligentes et des évaluations détaillées.</p>' +
                                '<div class="upgrade-benefits">' +
                                    '<span class="benefit">📊 Scores d\'évaluation</span>' +
                                    '<span class="benefit">💡 Suggestions d\'amélioration</span>' +
                                    '<span class="benefit">🎯 Analyse de structure</span>' +
                                '</div>' +
                                '<button type="button" class="pkpButton pkpButton--secondary upgrade-button" onclick="showUpgradeInfo()">' +
                                    '💎 Découvrir Premium' +
                                '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                
                // Insert after the iframe container
                container.appendChild(aiContainer);
            }
        });
        
        return true;
    }
    
    // Function to show upgrade information
    window.showUpgradeInfo = function() {
        var message = '🌟 Passez à Premium pour débloquer l\'analyse IA Santaane !\n\n' +
                     'Avec votre abonnement Premium, vous bénéficierez de :\n' +
                     '• Analyse intelligente de vos résumés\n' +
                     '• Scores d\'évaluation détaillés\n' +
                     '• Suggestions d\'amélioration personnalisées\n' +
                     '• Analyse de structure et de clarté\n\n' +
                     'Contactez votre administrateur pour plus d\'informations.';
        
        alert(message);
    };
    
    // Launch AI analysis
    function launchAIAnalysis(container, iframe) {
        var button = container.querySelector('.santaane-ai-button');
        var results = container.querySelector('#santaane-ai-results');
        
        // Get abstract content from the TinyMCE iframe
        var abstractText = '';
        
        if (iframe && typeof tinyMCE !== 'undefined') {
            try {
                var editorId = iframe.id;
                
                // Extract the editor ID from the iframe ID (remove _ifr suffix)
                var actualEditorId = editorId.replace('_ifr', '');
                
                var editor = tinyMCE.get(actualEditorId);
                if (editor) {
                    abstractText = editor.getContent({format: 'text'});
                }
            } catch (e) {
                // Silent error handling
            }
        }
        
        if (!abstractText.trim()) {
            alert('⚠️ Veuillez d\'abord saisir votre resume dans le champ correspondant.');
            return;
        }
        
        // Show loading state
        button.innerHTML = '🔄 Analyse en cours...';
                    button.disabled = true;
        
        // Simulate AI analysis (replace with real API call)
        setTimeout(function() {
            // Always show detailed results
            results.style.display = 'block';
            results.innerHTML = 
                '<div class="pkpFormField__description" style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #007cba;">' +
                    '<h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px; font-weight: 600;">📊 Resultats de l\'analyse IA</h4>' +
                    
                    '<div style="margin-bottom: 15px;">' +
                        '<strong style="color: #555;">Statistiques:</strong><br>' +
                        '<span style="color: #666; font-size: 14px;">' +
                            '• Mots: <strong>' + abstractText.split(' ').length + '</strong><br>' +
                            '• Caracteres: <strong>' + abstractText.length + '</strong>' +
                        '</span>' +
                    '</div>' +
                    
                    '<div style="margin-bottom: 15px;">' +
                        '<strong style="color: #555;">💡 Suggestions d\'amelioration:</strong><br>' +
                        '<span style="color: #666; font-size: 14px; line-height: 1.5;">' +
                            '• ✅ Votre resume semble bien structure<br>' +
                            '• 📝 Considerer ajouter plus de details methodologiques<br>' +
                            '• 🎯 Evitez l\'utilisation de la premiere personne<br>' +
                            '• 📏 Maintenez une longueur appropriee' +
                        '</span>' +
                    '</div>' +
                    
                    '<div style="font-size: 12px; color: #888; font-style: italic; border-top: 1px solid #e9ecef; padding-top: 10px;">' +
                        'Analyse effectuee par l\'IA Santaane' +
                    '</div>' +
                '</div>';
            
            // Reset button
            button.innerHTML = '🚀 Lancer l\'analyse IA';
            button.disabled = false;
        }, 2000);
    }
    
    // Try to inject immediately
    if (injectAIAnalysisButton()) {
        return;
    }
    
    // If not found immediately, wait and retry
    var attempts = 0;
    var maxAttempts = 10;
    
    function tryInjection() {
        attempts++;
        
        if (injectAIAnalysisButton()) {
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(tryInjection, 1000 * attempts); // Increasing delay
        }
    }
    
    // Start trying after a short delay
    setTimeout(tryInjection, 1000);
});