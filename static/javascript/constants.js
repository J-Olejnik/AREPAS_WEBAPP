export const ELEMENTS = {
    MAIN: 'main',
    DROP_AREA: 'dropArea',
    FILE_INPUT: 'fileInput',
    MODEL_FILE_INPUT: 'modelFileInput',
    TEXT_BOX: 'textBox',
    DATA_CONTAINER: 'dataContainer',
    BTN_CONTAINER: 'btnContainer',
    INN_IMG_CONTAINER: 'innImgContainer',
    MENU: 'menu',
    MENU_BTN: 'menuBtn',
    SETTINGS_BTN: 'settingsBtn',
    PREV_BTN: 'prevBtn',
    NEXT_BTN: 'nextBtn',
    SAVE_BTN: 'saveBtn',
    IMG_BTNS: 'imgBtns',
    DOWNLOAD_BTN: 'downloadBtn',
    GRADCAM_BOX: 'gradCAMbox',
    PATIENT_ID: 'pID',
    TABLE_BODY: 'tableBody',
    IMG_INFO: 'imgInfo',
    HEADING: 'heading',
    DATA_POPUP: 'data-popup',
    SETTINGS_POPUP: 'settings-popup',
    POPUP_SAVE_BTN: 'popupSaveBtn',
    POPUP_DELETE_BTN: 'popupDeleteBtn'
};

export const TEMPLATES = {
    DATA_POPUP: 'data-popup-template',
    SETTINGS_POPUP: 'settings-popup-template',
    IMG_BTN: 'imgBtn-template',
    INSTRUCTIONS: 'instructions-template',
    DATABASE: 'database-template',
    ABOUT: 'about-template'
};

export const MENU_ITEMS = [
    { text: 'Home', name: 'main'},
    { text: 'Instructions', name: 'instructions'},
    { text: 'Database', name: 'database'},
    { text: 'About', name: 'about'},
    { text: 'Settings', name: 'settings'}
];

export const API_ENDPOINTS = {
    PREDICT: '/api/predict',
    MODEL_STATUS: '/api/model-status',
    MODEL_RELOAD: '/api/model-reload',
    LOAD_DATABASE: '/api/load-database',
    SAVE_TO_DATABASE: '/api/save-to-database',
    DELETE_FROM_DATABASE: '/api/delete-from-database'
};

export const CONFIG = {
    TYPING_SPEED: 20,
    MODEL_STATUS_CHECK_INTERVAL: 2000,
    MENU_ANIMATION_DELAY: 300
};