import { Auth, User as FirebaseUser } from "firebase/auth";

/*
 *   Copyright (c) 2021 Busy Human LLC
 *   All rights reserved.
 *   This file, its contents, concepts, methods, behavior, and operation  (collectively the "Software") are protected by trade secret, patent,  and copyright laws. The use of the Software is governed by a license  agreement. Disclosure of the Software to third parties, in any form,  in whole or in part, is expressly prohibited except as authorized by the license agreement.
 */
import {ref, Ref} from "vue";
import {Callback, CallbackController} from "./callbacks.js";

// Authentication Lifecycle

interface IGlobals {
    initialized: boolean;
    user: Ref<FirebaseUser | null>;
    userspace: Ref<any | null>;
    authenticated: Ref<boolean>;
    authChecked: boolean;
    onAuth: CallbackController<any>;
    onUnauth: CallbackController<any>;
    onAuthChecked: CallbackController<any>;
}

const globals: IGlobals = {
    initialized   : false,
    user          : ref(null),
    userspace     : ref(null),
    authenticated : ref(false),
    authChecked   : false,
    onAuth        : new CallbackController(),
    onUnauth      : new CallbackController(),
    onAuthChecked : new CallbackController()
};


function initialize(auth: Auth) {
    if(!globals.initialized) {
        globals.initialized   = true;
        globals.user          = ref(null);
        globals.userspace     = ref(null);
        globals.authenticated = ref(false);

        auth.onAuthStateChanged((userAuth) => {
            updateUserAuth(userAuth);
        });
    }
}

/**
 *
 * @param {import("firebase").default.UserInfo} user
 */
function updateUserAuth(user: FirebaseUser | null ) {
    if(user) {
        globals.authenticated.value = true;
        globals.user.value = user;
        globals.onAuth.run(globals.user.value);

    } else {
        globals.authenticated.value = false;
        globals.user.value = null;
        globals.onUnauth.run(globals.user.value);
    }
    globals.authChecked = true;
    globals.onAuthChecked.run(globals.user.value);
}

/**
 *
 * @param {import("@types/firebase")} [auth]
 */
function install(auth: Auth) {
    initialize(auth);
}

export const VueUserComposition = {
    install       : install,
    user          : globals.user,
    userspace     : globals.userspace,
    authenticated : globals.authenticated,
    onAuth        : (cb: Callback<FirebaseUser>) => globals.onAuth.add(cb),
    onUnauth      : (cb: Callback<void>) => globals.onUnauth.add(cb),
    onAuthChecked : (cb: Callback<FirebaseUser|null>) => globals.onAuthChecked.add(cb)
};