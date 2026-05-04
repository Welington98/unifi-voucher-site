/**
 * Import base packages
 */
const ldap = require('ldapjs');

/**
 * Import own modules
 */
const variables = require('./variables');
const log = require('./log');

/**
 * Escapes special characters in LDAP filter values (RFC 4515)
 *
 * @param {string} value
 * @return {string}
 */
const escapeFilterValue = (value) => {
    return value
        .replace(/\\/g, '\\5c')
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29')
        .replace(/\0/g, '\\00');
};

/**
 * Checks if a user is in the allowed users list
 *
 * @param {string} username
 * @return {boolean}
 */
const isUserAllowed = (username) => {
    if (!variables.authLdapAllowedUsers || variables.authLdapAllowedUsers.trim() === '') {
        return true;
    }

    const allowedUsers = variables.authLdapAllowedUsers
        .split(/[,;]/)
        .map(u => u.trim().toLowerCase())
        .filter(u => u.length > 0);

    return allowedUsers.includes(username.toLowerCase());
};

/**
 * Exports the LDAP functions
 */
module.exports = {
    /**
     * Authenticates a user against the configured LDAP server
     * Strategy: bind with service account → search user → bind as user
     *
     * @param {string} username
     * @param {string} password
     * @return {Promise<boolean>}
     */
    authenticate: (username, password) => {
        return new Promise((resolve, reject) => {
            if (!username || !password) {
                reject(new Error('Username and password are required'));
                return;
            }

            if (!isUserAllowed(username)) {
                log.warn(`[LDAP] User not in allowed list: ${username}`);
                reject(new Error('User not authorized'));
                return;
            }

            const client = ldap.createClient({
                url: variables.authLdapUrl,
                timeout: 5000,
                connectTimeout: 10000,
                tlsOptions: {
                    rejectUnauthorized: !variables.authLdapTlsSkipVerify
                }
            });

            client.on('error', (err) => {
                log.error(`[LDAP] Connection error: ${err.message}`);
                reject(new Error('LDAP connection error'));
            });

            const bindDn = variables.authLdapBindDn;
            const bindPassword = variables.authLdapBindPassword;

            client.bind(bindDn, bindPassword, (err) => {
                if (err) {
                    log.error(`[LDAP] Service account bind error: ${err.message}`);
                    client.destroy();
                    reject(new Error('LDAP service account bind failed'));
                    return;
                }

                const filter = variables.authLdapSearchFilter.replace('{{username}}', escapeFilterValue(username));

                client.search(variables.authLdapSearchBase, {
                    scope: 'sub',
                    filter,
                    attributes: ['dn']
                }, (err, res) => {
                    if (err) {
                        log.error(`[LDAP] Search error: ${err.message}`);
                        client.destroy();
                        reject(new Error('LDAP search failed'));
                        return;
                    }

                    let userDn = null;

                    res.on('searchEntry', (entry) => {
                        if (!userDn) {
                            userDn = entry.dn.toString();
                        }
                    });

                    res.on('error', (err) => {
                        log.error(`[LDAP] Search result error: ${err.message}`);
                        client.destroy();
                        reject(new Error('LDAP search result error'));
                    });

                    res.on('end', () => {
                        if (!userDn) {
                            log.warn(`[LDAP] User not found: ${username}`);
                            client.destroy();
                            reject(new Error('Invalid credentials'));
                            return;
                        }

                        client.bind(userDn, password, (err) => {
                            client.destroy();
                            if (err) {
                                log.warn(`[LDAP] Invalid credentials for user: ${username}`);
                                reject(new Error('Invalid credentials'));
                                return;
                            }

                            log.info(`[LDAP] User authenticated successfully: ${username}`);
                            resolve(true);
                        });
                    });
                });
            });
        });
    }
};
