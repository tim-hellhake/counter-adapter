/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property, Database } from 'gateway-addon';

import crypto from 'crypto';

class CounterDevice extends Device {
    private callbacks: { [name: string]: () => void } = {};
    private count: number = 0;
    private readonly countProperty: Property;

    constructor(adapter: any, private id: string, name: string, private database: Database) {
        super(adapter, id);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this.name = name;

        this.countProperty = this.createProperty('count', {
            type: 'integer',
            title: 'Count',
            readOnly: true
        });

        this.addCallbackAction('reset', 'Reset the counter', () => {
            this.saveCount(0);
        })

        this.addCallbackAction('increment', 'Increment the counter', () => {
            this.saveCount(this.count + 1);
        })

        this.loadCount();
    }

    async loadCount() {
        await this.database.open();
        const config = await this.database.loadConfig();
        const {
            timers
        } = config;

        if (timers) {
            for (const timer of timers) {
                if (timer.id == this.id && timer.count) {
                    this.updateCount(timer.count);
                }
            }
        }
    }

    async saveCount(newCount: number) {
        await this.database.open();
        const config = await this.database.loadConfig();
        const {
            timers
        } = config;

        if (timers) {
            for (const timer of timers) {
                if (timer.id == this.id) {
                    timer.count = newCount;
                }
            }
        }

        await this.database.saveConfig(config);
        this.updateCount(newCount);
    }

    updateCount(newCount: number) {
        this.count = newCount;
        this.countProperty.setCachedValue(newCount);
        this.notifyPropertyChanged(this.countProperty);
    }

    createProperty(id: string, description: {}): Property {
        const property = new Property(this, id, description);
        this.properties.set(id, property);
        return property;
    }

    addCallbackAction(title: string, description: string, callback: () => void) {
        this.addAction(title, {
            title,
            description
        });

        this.callbacks[title] = callback;
    }

    async performAction(action: any) {
        action.start();

        const callback = this.callbacks[action.name];

        if (callback) {
            callback();
        } else {
            console.warn(`Unknown action ${action.name}`);
        }

        action.finish();
    }
}

export class CounterAdapter extends Adapter {
    private readonly database: Database;

    constructor(addonManager: any, manifest: any) {
        super(addonManager, CounterAdapter.name, manifest.name);
        this.database = new Database(manifest.name)
        addonManager.addAdapter(this);
        this.createTimers();
    }

    private async createTimers() {
        const timers = await this.loadTimers();

        if (timers) {
            for (const timer of timers) {
                const counter = new CounterDevice(this, timer.id, timer.name, this.database);
                this.handleDeviceAdded(counter);
            }
        }
    }

    private async loadTimers() {
        await this.database.open();
        const config = await this.database.loadConfig();
        const {
            timers
        } = config;

        if (timers) {
            for (const timer of timers) {
                if (!timer.id) {
                    timer.id = `counter-${crypto.randomBytes(16).toString("hex")}`;
                }
            }
        }

        await this.database.saveConfig(config);
        return timers;
    }
}
