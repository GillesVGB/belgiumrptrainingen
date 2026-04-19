// js/main.js
const TrainingApp = {
    API_URL: '/api/trainingen',
    
    async apiRequest(options = {}) {
        const { method = 'GET', data = null, endpoint = '' } = options;
        let url = endpoint || this.API_URL;
        
        const fetchOptions = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (method === 'DELETE' && data && data.id) {
            url = `/api/training?id=${data.id}`;
        } else if (data && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(data);
            url = '/api/training';
        }
        
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        if (method === 'DELETE') return { success: true };
        return response.json();
    },
    
    async loadDashboardData() {
        try {
            const trainings = await this.apiRequest();
            const gameStatusRes = await fetch('/api/game-status');
            const gameStatus = await gameStatusRes.json();
            return {
                trainings: trainings || [],
                gameStatus: gameStatus
            };
        } catch (error) {
            console.error('Error loading data:', error);
            return { trainings: [], gameStatus: null };
        }
    },
    
    sortTrainings(trainings) {
        return [...trainings].sort((a, b) => {
            const dateA = this.parseDate(a.datum, a.tijd);
            const dateB = this.parseDate(b.datum, b.tijd);
            return dateB - dateA;
        });
    },
    
    parseDate(datum, tijd) {
        if (!datum) return 0;
        const parts = datum.split(/[-/]/);
        let day, month, year;
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                year = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                day = parseInt(parts[2]);
            } else {
                day = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                year = parseInt(parts[2]);
            }
        } else {
            return 0;
        }
        const [hour, minute] = (tijd || '00:00').split(':');
        return new Date(year, month, day, hour, minute).getTime();
    },
    
    formatDateLabel(datum, tijd) {
        if (!datum) return 'Datum onbekend';
        return `${datum} om ${tijd || '??:??'}`;
    },
    
    getStatusMeta(status) {
        const statusMap = {
            'aangekondigd': { label: 'Aangekondigd', icon: 'fa-bullhorn', pillClass: 'pill-status-aangekondigd' },
            'inloop': { label: 'Inloop', icon: 'fa-door-open', pillClass: 'pill-status-inloop' },
            'bezig': { label: 'Bezig', icon: 'fa-bolt', pillClass: 'pill-status-bezig' },
            'afgerond': { label: 'Afgerond', icon: 'fa-check-circle', pillClass: 'pill-status-afgerond' },
            'geannuleerd': { label: 'Geannuleerd', icon: 'fa-ban', pillClass: 'pill-status-geannuleerd' },
            'uitgesteld': { label: 'Uitgesteld', icon: 'fa-clock', pillClass: 'pill-status-uitgesteld' },
            'not_started': { label: 'Nog niet gestart', icon: 'fa-hourglass-start', pillClass: 'pill-status-not_started' },
            'in_progress': { label: 'Bezig', icon: 'fa-bolt', pillClass: 'pill-status-in_progress' },
            'completed': { label: 'Afgerond', icon: 'fa-check-circle', pillClass: 'pill-status-completed' },
            'cancelled': { label: 'Geannuleerd', icon: 'fa-ban', pillClass: 'pill-status-cancelled' },
            'delayed': { label: 'Uitgesteld', icon: 'fa-clock', pillClass: 'pill-status-delayed' }
        };
        return statusMap[status] || statusMap['aangekondigd'];
    },
    
    getServiceMeta(dienst) {
        const serviceMap = {
            'lokale_politie': { label: '🚓 Lokale Politie', icon: 'fa-shield-halved', pillClass: 'pill-service-politie' },
            'federale_politie': { label: '⭐ Federale Politie', icon: 'fa-shield-halved', pillClass: 'pill-service-politie' },
            'militaire_politie': { label: '⚔️ Militaire Politie', icon: 'fa-shield-halved', pillClass: 'pill-service-politie' },
            'politie': { label: '🚓 Politie', icon: 'fa-shield-halved', pillClass: 'pill-service-politie' },
            'ambulance': { label: '🚑 Ambulance', icon: 'fa-truck-medical', pillClass: 'pill-service-ambulance' },
            'brandweer': { label: '🔥 Brandweer', icon: 'fa-fire-extinguisher', pillClass: 'pill-service-brandweer' },
            'handhaving': { label: '🔧 Handhaving', icon: 'fa-gavel', pillClass: 'pill-service-handhaving' }
        };
        return serviceMap[dienst] || serviceMap['lokale_politie'];
    },
    
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
    
    renderGameStatusCard(gameStatus) {
        if (!gameStatus) {
            return `<div class="empty-state"><i class="fa-regular fa-circle-question"></i><p>Geen status informatie beschikbaar.</p></div>`;
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
                <div class="status-banner" style="background: ${stateInfo.color}20; border-left-color: ${stateInfo.color};">
                    <div>
                        <div class="eyebrow" style="margin-bottom: 0.5rem; color: ${stateInfo.color};">
                            <i class="fa-solid ${stateInfo.icon}"></i>
                            ${stateInfo.label}
                        </div>
                        <strong>${this.escapeHtml(gameStatus.title || 'Server Status')}</strong>
                        <p class="status-meta" style="margin-top: 0.5rem;">
                            ${this.escapeHtml(gameStatus.message || 'Geen verdere informatie.')}
                        </p>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderTableRows(trainings) {
        if (!trainings.length) {
            return `<table><td colspan="8"><div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>Geen trainingen gevonden.</p></div></td></tr>`;
        }
        
        return trainings.map(training => {
            const status = this.getStatusMeta(training.status);
            const service = this.getServiceMeta(training.dienst);
            const deelnemers = Array.isArray(training.aangemeld) ? training.aangemeld.length : (training.aangemeldCount || 0);
            
            return `
                <tr>
                    <td><code>${this.escapeHtml(training.id)}</code></td>
                    <td><strong>${this.escapeHtml(training.onderwerp || 'Training')}</strong>${training.notitie ? `<div class="table-note">${this.escapeHtml(training.notitie.substring(0, 50))}${training.notitie.length > 50 ? '...' : ''}</div>` : ''}</td>
                    <td><span class="pill ${service.pillClass}"><i class="fa-solid ${service.icon}"></i> ${service.label}</span></td>
                    <td>${this.escapeHtml(this.formatDateLabel(training.datum, training.tijd))}</td>
                    <td>${this.escapeHtml(training.trainer || '-')}</td>
                    <td><span class="pill ${status.pillClass}"><i class="fa-solid ${status.icon}"></i> ${training.status_text || status.label}</span></td>
                    <td>${deelnemers}/${training.maxDeelnemers || '-'}</td>
                    <td>${training.van_discord ? '<i class="fa-brands fa-discord"></i> Discord' : '<i class="fa-solid fa-globe"></i> Web'}</td>
                </tr>
            `;
        }).join('');
    },
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    
    fillElement(element, html) {
        if (element) element.innerHTML = html;
    },
    
    setText(element, text) {
        if (element) element.textContent = text;
    },
    
    showToast(message, type = 'info') {
        const toastWrap = document.querySelector('.toast-wrap') || (() => {
            const wrap = document.createElement('div');
            wrap.className = 'toast-wrap';
            document.body.appendChild(wrap);
            return wrap;
        })();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i><span>${message}</span>`;
        toastWrap.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
};