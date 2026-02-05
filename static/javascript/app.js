import { ELEMENTS } from './constants.js';
import { AppState, ModelStatusChecker } from './services.js';
import { TemplateHandler } from './handlers.js';
import { EventManager } from './events.js';

const App = (() => {
    function init() {
        // Initialize the websocket connection
        const socket = io({
            transports: ['websocket'],
            upgrade: false
        });

        // Save initial main content
        AppState.updateData({ 
            mainContent: document.getElementById(ELEMENTS.DATA_CONTAINER).innerHTML 
        });

        // Attach all event listeners
        EventManager.init();

        // Load templates and check model status
        TemplateHandler.loadTemplates();
        ModelStatusChecker.check();
    }

    return { init };
})();

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);