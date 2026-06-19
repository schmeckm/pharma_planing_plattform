import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '../stores/authStore';

import { connectSocket, disconnectSocket } from '../services/socket';

import { applyCockpitAuthToStore } from '../cockpit/authBridge';

import { setupPlanningGuards } from '../cockpit/guards';

import { buildPlanningRoutes } from '../cockpit/routes';

import { PLANNING_PREFIX } from '../cockpit/pathUtils';

import { installPlanningRouterBridge } from '../cockpit/planningRouterBridge.js';

import PublicLayout from '../layouts/PublicLayout.vue';

import AppLayout from '../layouts/AppLayout.vue';

import AdminLayout from '../layouts/AdminLayout.vue';

import CockpitEmbedLayout from '../layouts/CockpitEmbedLayout.vue';

import HomeView from '../views/HomeView.vue';

import LoginView from '../views/LoginView.vue';

import AuthCallbackView from '../views/AuthCallbackView.vue';

import DashboardView from '../views/DashboardView.vue';

import AdminDashboardView from '../views/admin/AdminDashboardView.vue';



const router = createRouter({

  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [

    {

      path: '/',

      component: PublicLayout,

      children: [

        { path: '', name: 'home', component: HomeView },

        { path: 'login', name: 'login', component: LoginView, meta: { titleKey: 'auth.login' } },

        { path: 'auth/callback', name: 'auth-callback', component: AuthCallbackView, meta: { titleKey: 'auth.callbackTitle' } },

      ],

    },

    {

      path: '/',

      component: AppLayout,

      meta: { requiresAuth: true },

      children: [

        {

          path: 'dashboard',

          name: 'dashboard',

          component: DashboardView,

          meta: { titleKey: 'nav.dashboard' },

        },

        {

          path: 'planning',

          component: CockpitEmbedLayout,

          meta: { isPlanning: true },

          children: [

            { path: '', redirect: { name: 'DailyWizard' } },

            ...buildPlanningRoutes(),

          ],

        },

      ],

    },

    {

      path: PLANNING_PREFIX,

      redirect: `${PLANNING_PREFIX}/wizard`,

    },

    {

      path: '/admin',

      component: AdminLayout,

      meta: { requiresAuth: true, requiresAdmin: true },

      children: [

        {

          path: '',

          name: 'admin-dashboard',

          component: AdminDashboardView,

          meta: { titleKey: 'nav.adminDashboard' },

        },

        {

          path: 'users',

          name: 'admin-users',

          component: () => import('../views/admin/AdminUsersView.vue'),

          meta: { titleKey: 'admin.users.title' },

        },

        {

          path: 'audit',

          name: 'admin-audit',

          component: () => import('../views/admin/AdminAuditView.vue'),

          meta: { titleKey: 'admin.audit.title' },

        },

        {

          path: 'system',

          name: 'admin-system',

          component: () => import('../views/admin/AdminSystemView.vue'),

          meta: { titleKey: 'admin.system.title' },

        },

        {

          path: 'email',

          name: 'admin-email',

          component: () => import('../views/admin/AdminEmailView.vue'),

          meta: { titleKey: 'admin.email.title' },

        },

      ],

    },

  ],

});



setupPlanningGuards(router);

installPlanningRouterBridge(router);



router.beforeEach(async (to, _from, next) => {

  const auth = useAuthStore();



  if (to.meta.requiresAuth && !auth.isAuthenticated) {

    return next({ name: 'login', query: { redirect: to.fullPath } });

  }



  if (to.meta.requiresAdmin && !auth.isAdmin) {

    return next({ name: 'dashboard' });

  }



  if (to.name === 'login' && auth.isAuthenticated) {

    return next({ name: 'dashboard' });

  }



  if (auth.isAuthenticated && (to.path.startsWith(PLANNING_PREFIX) || to.meta.requiresAuth)) {

    try {

      await applyCockpitAuthToStore(auth.user);

    } catch {

      // Cockpit-Session wird bei Bedarf offline erzeugt

    }

  }



  if (to.meta.requiresAuth && !to.meta.publicDisplay) {

    connectSocket(auth.token);

  } else {

    disconnectSocket();

  }



  next();

});



export default router;


