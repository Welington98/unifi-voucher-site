/**
 * Import base packages
 */
const crypto = require('crypto');

/**
 * Import own modules
 */
const variables = require('../modules/variables');
const log = require('../modules/log');
const cache = require('../modules/cache');
const unifi = require('../modules/unifi');

/**
 * Import own utils
 */
const bytes = require('../utils/bytes');

module.exports = {
    /**
     * GET - /guests
     *
     * @param req
     * @param res
     */
    get: async (req, res) => {
        if(req.query.refresh) {
            log.info('[Cache] Requesting UniFi Vouchers...');

            const vouchers = await unifi.list().catch((e) => {
                log.error('[Cache] Error requesting vouchers!');
                res.cookie('flashMessage', JSON.stringify({type: 'error', message: e}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/guests`);
            });

            if(!vouchers) {
                return;
            }

            log.info('[Cache] Requesting UniFi Guests...');

            const guests = await unifi.guests().catch((e) => {
                log.error('[Cache] Error requesting guests!');
                res.cookie('flashMessage', JSON.stringify({type: 'error', message: e}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/guests`);
            });

            if(vouchers && guests) {
                cache.vouchers = vouchers;
                cache.guests = guests;
                cache.updated = new Date().getTime();
                log.info(`[Cache] Saved ${vouchers.length} voucher(s)`);
                log.info(`[Cache] Saved ${guests.length} guest(s)`);

                res.cookie('flashMessage', JSON.stringify({type: 'info', message: 'Synced hotspot guests!'}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/guests`);
            }

            return;
        }

        const user = req.oidc ? req.user : { email: 'admin' };

        res.render('guests', {
            baseUrl: req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : '',
            gitTag: variables.gitTag,
            gitBuild: variables.gitBuild,
            user,
            userIcon: req.oidc ? crypto.createHash('sha256').update(user.email).digest('hex') : '',
            authDisabled: variables.authDisabled,
            info: req.flashMessage.type === 'info',
            info_text: req.flashMessage.message || '',
            error: req.flashMessage.type === 'error',
            error_text: req.flashMessage.message || '',
            kioskEnabled: variables.kioskEnabled,
            guests: cache.guests,
            updated: cache.updated,
            bytesConvert: bytes
        });
    }
};
