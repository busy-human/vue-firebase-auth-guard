/*
 *   Copyright (c) 2021 to 2025
 *   All rights reserved.
 */
import { Auth } from "firebase/auth";
import {App as VueApp, Plugin} from "vue";
import { UserModelMap, UserModelResolver } from "./user-model-resolver.js";
import { MainAuth, initializeAuthState } from "./auth-state.js";


interface VueUserPluginInstallOptions {
    auth: Auth,
    modelResolver: UserModelResolver<UserModelMap>
}

/**
 * Makes Firebase.auth.currentUser accessible across every vue instance via user
 * Call Vue.use(VueUserPlugin, { auth: firebase.auth() }) to install
 */
export const VueUserPluginBootstrapper: Plugin = {
    /**
     *
     * @param {*} app
     * @param {*} options - auth, modelResolver; where the modelResolver function returns some sort of data structure associated with the user
     */
    install: function<TypeMap>(app: VueApp, {auth, modelResolver}: VueUserPluginInstallOptions) {
        initializeAuthState(auth, modelResolver);

        app.mixin({
            data() {
                return {
                    user: null
                };
            },
            computed: {
                loggedIn() {
                    return this.user && this.user.loggedIn;
                }
            },
            mounted: function() {
                if(this.$options.onAuthStateChanged) {
                    MainAuth.onChange(this.$options.onAuthStateChanged);
                }
                if(this.$options.userModelChanged) {
                    if(!modelResolver) {
                        console.warn(`[WARN] userModelChanged hook won't be called since no modelBuilder was provided to VueUserPlugin.`)
                    }
                    MainAuth.onChange(this.$options.userModelChanged);
                } else {
                    MainAuth.onChange(this.$options.userModelChanged, { once: true });
                }
            }
        });
    }
};

export default VueUserPluginBootstrapper;