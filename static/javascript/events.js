import { CONFIG, ELEMENTS, MENU_ITEMS } from './constants.js';
import { AppState } from './services.js';
import { DOMHelpers } from './utils.js';
import { ImageHandler, PopupHandler, NavigationHandler, TemplateHandler } from './handlers.js';

export const EventManager = (() => {
    function attachInputListeners() {
        const dropArea = document.getElementById(ELEMENTS.DROP_AREA);
        const fileInput = document.getElementById(ELEMENTS.FILE_INPUT);
        
        // Drag and drop
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.add('hover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.remove('hover');
            }, false);
        });

        const handleFileSource = fileList => {
            const files = [...fileList].filter(f => f.type.startsWith('image/'));
            if (!files.length) return;
            AppState.updateData({ inputData: files });
            ImageHandler.handleFiles(files);
        };

        dropArea.addEventListener('drop', e => {
            if (dropArea.dataset.disabled === 'true') return;

            handleFileSource(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', e =>
            handleFileSource(e.target.files)
        );
    }

    function attachClickListeners() {
        const clickActions = {
            save: (el) => PopupHandler.saveData(el.dataset.id),
            delete: (el) => PopupHandler.deleteData(el.dataset.id),
            loadRowData: (el) => PopupHandler.openDataPopup(JSON.parse(el.dataset.rowData)),
            openDbPop: () => PopupHandler.openDataPopup(),
            openSetPop: () => PopupHandler.openSettingsPopup(),
            close: () => PopupHandler.closeDataPopup(),
            prev: () => NavigationHandler.navigatePrevious(),
            next: () => NavigationHandler.navigateNext(),
            download: () => DOMHelpers.downloadGradCAM(),  
            pickImage: () => document.getElementById(ELEMENTS.FILE_INPUT).click(),
            pickModel: () => document.getElementById(ELEMENTS.MODEL_FILE_INPUT).click()
        };

        document.getElementById(ELEMENTS.MAIN).addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = clickActions[btn.dataset.action];
            if (action) action(btn);
        });
    }

    function attachDragListeners() {
        const state = AppState.getState();
        const main = document.getElementById(ELEMENTS.MAIN);
        let offsetX = 0;
        let offsetY = 0;

        main.addEventListener('pointerdown', e => {
            const popup = e.target.closest('#data-popup');
            if (!popup) return;

            // Ignore interactive elements
            if (e.target.closest('.popup-close, .popup-item')) return;

            AppState.updateUI({ activePopup: popup});

            const mainRect = main.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();

            popup.style.left = `${popupRect.left - mainRect.left}px`;
            popup.style.top = `${popupRect.top - mainRect.top}px`;
            popup.style.transform = 'none';

            offsetX = e.clientX - popupRect.left;
            offsetY = e.clientY - popupRect.top;
        });

        main.addEventListener('pointermove', e => {
            if(!state.ui.activePopup) return;

            const mainRect = main.getBoundingClientRect();
            const popupRect = state.ui.activePopup.getBoundingClientRect();

            let left = e.clientX - offsetX;
            let top = e.clientY - offsetY;

            // Constrain within main div
            left = Math.max(mainRect.left, Math.min(left, mainRect.right - popupRect.width));
            top = Math.max(mainRect.top, Math.min(top, mainRect.bottom - popupRect.height));

            // Convert to main-relative coordinates
            left -= mainRect.left;
            top -= mainRect.top;

            state.ui.activePopup.style.left = `${left}px`;
            state.ui.activePopup.style.top = `${top}px`;
        });

        main.addEventListener('pointerup', e => {
            if(!state.ui.activePopup) return;
            
            AppState.updateUI({ activePopup: null});
        });
    }

    function attachMenuListeners() {
        const menuBtn = document.getElementById(ELEMENTS.MENU_BTN);
        const menu = document.getElementById(ELEMENTS.MENU);
        let settingsBtn = document.getElementById(ELEMENTS.SETTINGS_BTN);
        const menuCheckbox = menuBtn.querySelector('input');

        menuBtn.addEventListener('click', (event) => {
            event.preventDefault();
            menuCheckbox.checked = !menuCheckbox.checked;
            
            const isExpanding = menu.style.width !== '200px';
            menu.style.width = isExpanding ? '200px' : '60px';

            if (isExpanding) {
                setTimeout(() => {
                    const menuContainer = document.createElement('div');
                    menuContainer.classList.add('menuItemsContainer');
                    
                    MENU_ITEMS.slice(0, -1).forEach(item => {
                        const menuItemEl = document.createElement('div');
                        menuItemEl.id = item.text.toLowerCase() + 'Btn';
                        menuItemEl.classList.add('menuItem');
            
                        const textEl = document.createElement('span');
                        textEl.textContent = item.text;
            
                        menuItemEl.appendChild(textEl);
                        menuItemEl.addEventListener('mouseover', () => menuItemEl.classList.add('hover'));
                        menuItemEl.addEventListener('mouseout', () => menuItemEl.classList.remove('hover'));
                        menuItemEl.addEventListener('click', () => TemplateHandler.setTemplate(item));

                        menuContainer.appendChild(menuItemEl);
                    });
            
                    menu.appendChild(menuContainer);

                    const textEl = document.createElement('span');
                    textEl.textContent = MENU_ITEMS.at(-1).text;
                    settingsBtn.appendChild(textEl);
                    settingsBtn.addEventListener('mouseover', () => settingsBtn.classList.add('hover'));
                    settingsBtn.addEventListener('mouseout', () => settingsBtn.classList.remove('hover'));
                
                }, CONFIG.MENU_ANIMATION_DELAY);
            } else {
                const container = menu.querySelector('.menuItemsContainer');
                if (container) menu.removeChild(container);

                const span = settingsBtn.querySelector('span');
                if (span) settingsBtn.removeChild(span);
                const newBtn = settingsBtn.cloneNode(true);
                settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
                settingsBtn = document.getElementById(ELEMENTS.SETTINGS_BTN);
                settingsBtn.addEventListener('click', () => PopupHandler.openSettingsPopup());
            }
        });

        settingsBtn.addEventListener('click', () => PopupHandler.openSettingsPopup());
    }

    function attachAllListeners() {
        attachInputListeners();
        attachClickListeners();
        attachDragListeners();
        attachMenuListeners();
    }

    return {
        init: attachAllListeners,
        attachInputListeners,
        attachClickListeners,
        attachDragListeners,
        attachMenuListeners
    };
})();