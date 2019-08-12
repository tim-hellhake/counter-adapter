/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property, Database } from 'gateway-addon';

import crypto from 'crypto';

class CounterDevice extends Device {
    private callbacks: { [name: string]: () => void } = {};

    constructor(adapter: any, id: string, name: string) {
        super(adapter, id);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this.name = name;
        let count: number = 0;

        const countProperty = this.createProperty('count', {
            type: 'integer',
            title: 'Count',
            readOnly: true
        });

        this.addCallbackAction('reset', 'Reset the counter', () => {
            count = 0;
            countProperty.setCachedValue(count);
            this.notifyPropertyChanged(countProperty);
        })

        this.addCallbackAction('increment', 'Increment the counter', () => {
            count++;
            countProperty.setCachedValue(count);
            this.notifyPropertyChanged(countProperty);
        })
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
                const counter = new CounterDevice(this, timer.id, timer.name);
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
                    timer.id = crypto.randomBytes(16).toString("hex");
                }
            }
        }

        await this.database.saveConfig(config);
        return timers;
    }
}
