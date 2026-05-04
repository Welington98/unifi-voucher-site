/**
 * Import own modules
 */
const variables = require('../modules/variables');
const jwt = require('../modules/jwt');
const ldap = require('../modules/ldap');

module.exports = {
    login: {
        /**
         * GET - /login
         *
         * @param req
         * @param res
         */
        get: (req, res) => {
            // Check if authentication is disabled
            if (variables.authDisabled) {
                res.redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/vouchers`);
                return;
            }

            // Check if OIDC redirects are enabled
            if (variables.authOidcEnabled && variables.authOidcRedirectLogin) {
                res.redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/oidc/login`);
                return;
            }

            const hour = new Date().getHours();
            const timeHeader = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

            res.render('login', {
                baseUrl: req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : '',
                error: req.flashMessage.type === 'error',
                error_text: req.flashMessage.message || '',
                app_header: timeHeader,
                internalAuth: variables.authInternalEnabled,
                ldapAuth: variables.authLdapEnabled,
                oidcAuth: variables.authOidcEnabled
            });
        },

        /**
         * POST - /login
         *
         * @param req
         * @param res
         */
        post: async (req, res) => {
            // Check if internal authentication is enabled
            if(!variables.authInternalEnabled) {
                res.status(501).send();
                return;
            }

            if (typeof req.body === "undefined") {
                res.status(400).send();
                return;
            }

            const passwordCheck = req.body.password === variables.authInternalPassword;

            if (!passwordCheck) {
                res.cookie('flashMessage', JSON.stringify({type: 'error', message: 'Password Invalid!'}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/login`);
                return;
            }

            res.cookie('authorization', jwt.sign(), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/vouchers`);
        }
    },

    ldapLogin: {
        /**
         * POST - /login/ldap
         *
         * @param req
         * @param res
         */
        post: async (req, res) => {
            if (!variables.authLdapEnabled) {
                res.status(501).send();
                return;
            }

            if (typeof req.body === 'undefined') {
                res.status(400).send();
                return;
            }

            const { username, password } = req.body;

            if (!username || !password) {
                res.cookie('flashMessage', JSON.stringify({type: 'error', message: 'Username and password are required!'}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/login`);
                return;
            }

            const authenticated = await ldap.authenticate(username, password).catch((err) => {
                log.warn(`[Auth] LDAP authentication failed: ${err.message}`);
                return false;
            });

            if (!authenticated) {
                res.cookie('flashMessage', JSON.stringify({type: 'error', message: 'Invalid LDAP credentials!'}), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/login`);
                return;
            }

            res.cookie('authorization', jwt.sign(), {httpOnly: true, expires: new Date(Date.now() + 24 * 60 * 60 * 1000)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/vouchers`);
        }
    },

    logout: {
        /**
         * GET - /logout
         *
         * @param req
         * @param res
         */
        get: (req, res) => {
            // Check if authentication is disabled
            if (variables.authDisabled) {
                res.redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/vouchers`);
                return;
            }

            if(req.oidc) {
                res.redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/oidc/logout`);
            } else {
                res.cookie('authorization', '', {httpOnly: true, expires: new Date(0)}).redirect(302, `${req.headers['x-ingress-path'] ? req.headers['x-ingress-path'] : ''}/`);
            }
        }
    }
};
