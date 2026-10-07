const categories = require('./categories');
const skills = require('./skills');
const cities = require('./cities');
const legacy = require('./legacyStack');

// Bump when the taxonomy or classification prompt changes meaningfully.
const CLASSIFICATION_VERSION = 2;

module.exports = { ...categories, ...skills, ...cities, ...legacy, CLASSIFICATION_VERSION };
