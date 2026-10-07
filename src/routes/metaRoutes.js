const express = require('express');
const { CATEGORY_DEFS, SKILL_DEFS, TRACKS } = require('../taxonomy');
const { REMOTE_TYPE_OPTIONS, EXPERIENCE_BUCKETS } = require('../constants');

const router = express.Router();

// The closed lists clients (web, mobile admin) use to render pickers — single source of truth.
router.get('/taxonomy', (req, res) => {
  res.json({
    tracks: TRACKS,
    categories: CATEGORY_DEFS.map(c => ({ name: c.name, track: c.track })),
    skills: SKILL_DEFS.map(s => ({ name: s.name, group: s.group })),
    remoteTypes: REMOTE_TYPE_OPTIONS,
    experienceBuckets: Object.keys(EXPERIENCE_BUCKETS),
  });
});

module.exports = router;
