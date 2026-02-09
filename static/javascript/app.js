import { ELEMENTS } from './constants.js';
import { AppState, SocketService } from './services.js';
import { TemplateHandler } from './handlers.js';
import { EventManager } from './events.js';

const App = (() => {
    function init() {
        // Initialize the websocket connection
        SocketService.init();

        // Save initial main content
        AppState.updateData({ 
            mainContent: document.getElementById(ELEMENTS.DATA_CONTAINER).innerHTML 
        });

        // Attach all event listeners
        EventManager.init();

        // Load templates and check model status
        TemplateHandler.loadTemplates();
    }

    return { init };
})();

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);