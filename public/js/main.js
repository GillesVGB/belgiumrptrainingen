// js/main.js - Plaats dit in de map /js/

const TrainingApp = {
    // API endpoint (vervang met jouw Netlify URL)
    API_URL: 'https://belgium-roleplay.netlify.app/.netlify/functions/api',
    
    // Helper: HTTP requests
    async apiRequest(options = {}) {
        const { method = 'GET', data = null, endpoint = '' } = options;
        const url = endpoint || this.API_URL;
        
        const fetchOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            fetchOptions.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        return response.json();
    },
    
    // Data laden van de API
    async loadDashboardData() {
        try {
            const response = await this.apiRequest();
            return {
                trainings: response.trainings || [],
                gameStatus: response.gameStatus || {
                    state: 'operational',
                    state_label: 'Operationeel',
                    title: 'Server Operationeel',
                    message: 'Alles werkt normaal.'
                }
            };
        } catch (error) {
            console.error('Error loading data:', error);
            // Return fallback data als de API niet beschikbaar is
            return {
                trainings: [],
                gameStatus: {
                    state: 'operational',
                    state_label: 'Operationeel',
                    title: 'Server Operationeel',
                    message: 'De server draait normaal.'
                }
            };
        }
    },
    
    // Trainingen sorteren
    sortTrainings(trainings) {
        return [...trainings].sort((a, b) => {
            // Sort by date (nieuwste eerst)
            const dateA = this.parseDate(a.datum, a.tijd);
            const dateB = this.parseDate(b.datum, b.tijd);
            return dateB - dateA;
        });
    },
    
    // Datum parsen (DD/MM/YYYY)
    parseDate(datum, tijd) {
        if (!datum) return 0;
        const [day, month, year] = datum.split('/');
        const [hour, minute] = (tijd || '00:00').split(':');
        return new Date(year, month - 1, day, hour, minute).getTime();
    },
    
    // Formatteer datum voor weergave
    formatDateLabel(datum, tijd) {
        if (!datum) return 'Datum onbekend';
        return `${datum} om ${tijd || '??:??'}`;
    },
    
    // Status meta data
    getStatusMeta(status) {
        const statusMap = {
            'not_started': { label: 'Nog niet gestart', icon: 'fa-hourglass-start', pillClass: 'pill-status-not_started' },
            'in_progress': { label: 'Bezig', icon: 'fa-bolt', pillClass: 'pill-status-in_progress' },
            'completed': { label: 'Afgerond', icon: 'fa-check-circle', pillClass: 'pill-status-completed' },
            'cancelled': { label: 'Geannuleerd', icon: 'fa-ban', pillClass: 'pill-status-cancelled' },
            'delayed': { label: 'Uitgesteld', icon: 'fa-clock', pillClass: 'pill-status-delayed' }
        };
        return statusMap[status] || statusMap['not_started'];
    },
    
    // Dienst meta data
    getServiceMeta(dienst) {
        const serviceMap = {
            'politie': { label: 'Politie', icon: 'fa-shield-halved', pillClass: 'pill-service-politie' },
            'ambulance': { label: 'Ambulance', icon: 'fa-truck-medical', pillClass: 'pill-service-ambulance' },
            'brandweer': { label: 'Brandweer', icon: 'fa-fire-extinguisher', pillClass: 'pill-service-brandweer' },
            'handhaving': { label: 'Handhaving', icon: 'fa-gavel', pillClass: 'pill-service-handhaving' },
            'algemeen': { label: 'Algemeen', icon: 'fa-users', pillClass: 'pill-service-algemeen' }
        };
        return serviceMap[dienst] || serviceMap['algemeen'];
    },
    
    // Render een training kaart
    renderTrainingCard(training) {
        const status = this.getStatusMeta(training.status);
        const service = this.getServiceMeta(training.dienst);
        const deelnemers = Array.isArray(training.aangemeld) ? training.aangemeld.length : (training.aangemeldCount || 0);
        
        return `
            <article class="training-card">
                <div class="training-card__top">
                    <div>
                        <span class="pill ${service.pillClass}">
                            <i class="fa-solid ${service.icon}"></i>
                            ${service.label}
                        </span>
                    </div>
                    <span class="pill ${status.pillClass}">
                        <i class="fa-solid ${status.icon}"></i>
                        ${training.status_text || status.label}
                    </span>
                </div>
                
                <h3>${this.escapeHtml(training.onderwerp || 'Training')}</h3>
                
                <div class="meta-grid">
                    <div class="meta-item">
                        <i class="fa-solid fa-calendar"></i>
                        <span>${this.escapeHtml(this.formatDateLabel(training.datum, training.tijd))}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-chalkboard-user"></i>
                        <span>${this.escapeHtml(training.trainer || 'Onbekend')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${this.escapeHtml(training.locatie || 'Nader te bepalen')}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-users"></i>
                        <span>${deelnemers}/${training.maxDeelnemers || '?'}</span>
                    </div>
                </div>
                
                ${training.notitie ? `
                    <div class="inline-note">
                        <i class="fa-regular fa-note-sticky"></i>
                        ${this.escapeHtml(training.notitie)}
                    </div>
                ` : ''}
                
                ${training.van_discord ? `
                    <div class="badge-muted">
                        <i class="fa-brands fa-discord"></i>
                        Toegevoegd via Discord
                    </div>
                ` : ''}
            </article>
        `;
    },
    
    // Render game status kaart
    renderGameStatusCard(gameStatus) {
        if (!gameStatus) {
            return `
                <div class="empty-state">
                    <i class="fa-regular fa-circle-question"></i>
                    <p>Geen status informatie beschikbaar.</p>
                </div>
            `;
        }
        
        const stateColors = {
            'operational': { color: '#27c08a', icon: 'fa-circle-check', label: 'Operationeel' },
            'alert': { color: '#f6c24f', icon: 'fa-triangle-exclamation', label: 'Verhoogde paraatheid' },
            'maintenance': { color: '#88bfff', icon: 'fa-wrench', label: 'Onderhoud' },
            'outage': { color: '#ff625c', icon: 'fa-circle-exclamation', label: 'Offline' }
        };
        
        const stateInfo = stateColors[gameStatus.state] || stateColors['operational'];
        
        return `
            <div class="status-board" style="padding: 0;">
                <div class="status-banner">
                    <div>
                        <div class="eyebrow" style="margin-bottom: 0.5rem;">
                            <i class="fa-solid ${stateInfo.icon}"></i>
                            ${stateInfo.label}
                        </div>
                        <strong>${this.escapeHtml(gameStatus.title || 'Server Status')}</strong>
                        <p class="status-meta" style="margin-top: 0.5rem;">
                            ${this.escapeHtml(gameStatus.message || 'Geen verdere informatie.')}
                        </p>
                    </div>
                </div>
                
                <div style="padding: 1rem;">
                    <div class="meta-grid">
                        ${gameStatus.serverName ? `
                            <div class="meta-item">
                                <i class="fa-solid fa-server"></i>
                                <span>${this.escapeHtml(gameStatus.serverName)}</span>
                            </div>
                        ` : ''}
                        
                        ${gameStatus.playersOnline ? `
                            <div class="meta-item">
                                <i class="fa-solid fa-users"></i>
                                <span>${gameStatus.playersOnline}/${gameStatus.maxPlayers || '?'} spelers</span>
                            </div>
                        ` : ''}
                        
                        ${gameStatus.joinCode ? `
                            <div class="meta-item">
                                <i class="fa-solid fa-key"></i>
                                <span>Code: ${this.escapeHtml(gameStatus.joinCode)}</span>
                            </div>
                        ` : ''}
                        
                        <div class="meta-item">
                            <i class="fa-regular fa-clock"></i>
                            <span>Laatste update: ${new Date().toLocaleString('nl-NL')}</span>
                        </div>
                    </div>
                    
                    ${gameStatus.imageUrl ? `
                        <img src="${this.escapeHtml(gameStatus.imageUrl)}" alt="Status image" style="max-width: 100%; border-radius: var(--radius-md); margin-top: 1rem;">
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Render tabel rijen voor dashboard
    renderTableRows(trainings) {
        if (!trainings.length) {
            return `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fa-regular fa-folder-open"></i>
                            <p>Geen trainingen gevonden.</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        return trainings.map(training => {
            const status = this.getStatusMeta(training.status);
            const service = this.getServiceMeta(training.dienst);
            const deelnemers = Array.isArray(training.aangemeld) ? training.aangemeld.length : (training.aangemeldCount || 0);
            
            return `
                <tr>
                    <td><code>${this.escapeHtml(training.id)}</code></td>
                    <td>
                        <strong>${this.escapeHtml(training.onderwerp || 'Training')}</strong>
                        ${training.notitie ? `<div class="table-note">${this.escapeHtml(training.notitie.substring(0, 50))}${training.notitie.length > 50 ? '...' : ''}</div>` : ''}
                    </td>
                    <td>
                        <span class="pill ${service.pillClass}">
                            <i class="fa-solid ${service.icon}"></i>
                            ${service.label}
                        </span>
                    </td>
                    <td>${this.escapeHtml(this.formatDateLabel(training.datum, training.tijd))}</td>
                    <td>${this.escapeHtml(training.trainer || '-')}</td>
                    <td>
                        <span class="pill ${status.pillClass}">
                            <i class="fa-solid ${status.icon}"></i>
                            ${training.status_text || status.label}
                        </span>
                    </td>
                    <td>${deelnemers}/${training.maxDeelnemers || '-'}</td>
                    <td>${training.van_discord ? '<i class="fa-brands fa-discord"></i> Discord' : '<i class="fa-solid fa-globe"></i> Web'}</td>
                </tr>
            `;
        }).join('');
    },
    
    // HTML escaping
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    // Helper: Element vullen
    fillElement(element, html) {
        if (element) element.innerHTML = html;
    },
    
    // Helper: Text zetten
    setText(element, text) {
        if (element) element.textContent = text;
    },
    
    // Toast notificatie
    showToast(message, type = 'info') {
        const toastWrap = document.querySelector('.toast-wrap') || (() => {
            const wrap = document.createElement('div');
            wrap.className = 'toast-wrap';
            document.body.appendChild(wrap);
            return wrap;
        })();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastWrap.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
};

// Exporteer voor gebruik in andere scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrainingApp;
}