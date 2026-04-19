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
            if (method === 'PUT') url = '/api/training';
            if (method === 'POST') url = '/api/training';
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
            return {
                trainings: trainings || [],
                gameStatus: {
                    state: 'operational',
                    state_label: 'Operationeel',
                    title: 'Server Operationeel',
                    message: 'Alles werkt normaal.'
                }
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
        const [day, month, year] = datum.split('/');
        const [hour, minute] = (tijd || '00:00').split(':');
        return new Date(year, month - 1, day, hour, minute).getTime();
    },
    
    formatDateLabel(datum, tijd) {
        if (!datum) return 'Datum onbekend';
        return `${datum} om ${tijd || '??:??'}`;
    },
    
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
    
    renderGameStatusCard(gameStatus) {
        if (!gameStatus) {
            return `<div class="empty-state"><i class="fa-regular fa-circle-question"></i><p>Geen status informatie beschikbaar.</p></div>`;
        }
        
        return `
            <div class="status-board" style="padding: 0;">
                <div class="status-banner">
                    <div>
                        <div class="eyebrow" style="margin-bottom: 0.5rem;">
                            <i class="fa-solid fa-circle-check"></i>
                            Operationeel
                        </div>
                        <strong>${this.escapeHtml(gameStatus.title || 'Server Status')}</strong>
                        <p class="status-meta" style="margin-top: 0.5rem;">${this.escapeHtml(gameStatus.message || 'Geen verdere informatie.')}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderTableRows(trainings) {
        if (!trainings.length) {
            return `<tr><td colspan="8"><div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>Geen trainingen gevonden.</p></div></td></tr>`;
        }
        
        return trainings.map(training => {
            const status = this.getStatusMeta(training.status);
            const service = this.getServiceMeta(training.dienst);
            const deelnemers = Array.isArray(training.aangemeld) ? training.aangemeld.length : 0;
            
            return `
                <tr>
                    <td><code>${this.escapeHtml(training.id)}</code></td>
                    <td><strong>${this.escapeHtml(training.onderwerp || 'Training')}</strong></td>
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