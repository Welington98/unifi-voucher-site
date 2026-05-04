/**
 * Import own modules
 */
const log = require('./log');
const fetch = require('../utils/fetch');

/**
 * UniFi module functions
 *
 * @type {{create: (function(*, number=, string=): Promise<*>), remove: (function(*): Promise<*>), list: (function(): Promise<*>), guests: (function(): Promise<*>)}}
 */
module.exports = {
    /**
     * Creates a new UniFi Voucher
     *
     * @param type
     * @param amount
     * @param note
     * @return {Promise<unknown>}
     */
    create: (type, amount = 1, note = '') => {
        return new Promise((resolve, reject) => {
            // Set base voucher data
            const data = {
                count: typeof amount === "string" ? parseInt(amount): amount,
                name: note,
                timeLimitMinutes: parseInt(type.expiration)
            };

            // Set voucher limit usage if limited
            if(parseInt(type.usage) !== 0) {
                data.authorizedGuestLimit = parseInt(type.usage);
            }

            // Set data usage limit if limited
            if(typeof type.megabytes !== "undefined") {
                data.dataUsageLimitMBytes = parseInt(type.megabytes);
            }

            // Set download speed limit if limited
            if(typeof type.download !== "undefined") {
                data.rxRateLimitKbps = parseInt(type.download);
            }

            // Set upload speed limit if limited
            if(typeof type.upload !== "undefined") {
                data.txRateLimitKbps = parseInt(type.upload);
            }

            fetch(`/hotspot/vouchers`, 'POST', {}, data).then((response) => {
                if(amount > 1) {
                    log.info(`[UniFi] Created ${amount} vouchers`);
                    resolve(true);
                } else {
                    const voucherCode = `${[response.vouchers[0].code.slice(0, 5), '-', response.vouchers[0].code.slice(5)].join('')}`;
                    log.info(`[UniFi] Created voucher with code: ${voucherCode}`);
                    resolve(voucherCode);
                }
            }).catch((e) => {
                log.error('[UniFi] Error while creating voucher!');
                log.debug(e);
                reject('[UniFi] Error while creating voucher!');
            });
        });
    },

    /**
     * Removes a UniFi Voucher
     *
     * @param id
     * @return {Promise<unknown>}
     */
    remove: (id) => {
        return new Promise((resolve, reject) => {
            fetch(`/hotspot/vouchers/${id}`, 'DELETE').then(() => {
                log.info(`[UniFi] Deleted voucher: ${id}`);
                resolve(true);
            }).catch((e) => {
                log.error('[UniFi] Error while removing voucher!');
                log.debug(e);
                reject('[UniFi] Error while removing voucher!');
            });
        });
    },

    /**
     * Returns a list with all UniFi Vouchers
     *
     * @return {Promise<unknown>}
     */
    list: () => {
        return new Promise((resolve, reject) => {
            fetch('/hotspot/vouchers', 'GET', {
                limit: 10000
            }).then((vouchers) => {
                log.debug(`[UniFi] Found ${vouchers.length} voucher(s)`);
                resolve(vouchers.sort((a, b) => {
                    if (a.createdAt > b.createdAt) return -1;
                    if (a.createdAt < b.createdAt) return 1;
                }));
            }).catch((e) => {
                log.error('[UniFi] Error while getting vouchers!');
                log.debug(e);
                reject('[UniFi] Error while getting vouchers!');
            });
        });
    },

    /**
     * Returns a list with all UniFi Guests
     *
     * @return {Promise<unknown>}
     */
    guests: () => {
        return new Promise((resolve, reject) => {
            fetch('/clients', 'GET', {
                filter: 'access.type.eq(\'GUEST\')',
                limit: 10000
            }).then((clients) => {
                const guests = clients.map((client) => {
                    return {
                        id: client.id,
                        mac: client.macAddress || client.mac || '-',
                        hostname: client.name || client.hostname || client.macAddress || client.mac || '-',
                        ip: client.ipAddress || client.ip || '-',
                        connected_at: client.connectedAt || null,
                        authorized: client.access ? client.access.authorized === true : false,
                        tx_bytes: client.txBytes || client.tx_bytes || 0,
                        rx_bytes: client.rxBytes || client.rx_bytes || 0
                    };
                }).sort((a, b) => {
                    if(!a.connected_at || !b.connected_at) {
                        return 0;
                    }

                    return new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime();
                });

                log.debug(`[UniFi] Found ${guests.length} guest(s)`);
                resolve(guests);
            }).catch((e) => {
                log.error('[UniFi] Error while getting guests!');
                log.debug(e);
                reject('[UniFi] Error while getting guests!');
            });
        });
    }
}
