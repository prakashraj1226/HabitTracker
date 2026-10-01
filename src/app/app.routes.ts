import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { signedInGuard, signedOutGuard } from './core/auth.guard';
import { CalendarComponent } from './calendar/calendar.component';
import { HabitDetailComponent } from './habit/habit-detail/habit-detail.component';
import { HabitWizardComponent } from './habit/habit-wizard/habit-wizard.component';
import { HomeComponent } from './home/home.component';
import { ShellComponent } from './layout/shell/shell.component';
import { PlanComponent } from './plan/plan.component';
import { SettingsComponent } from './settings/settings.component';
import { StatsComponent } from './stats/stats.component';
import { TasksComponent } from './tasks/tasks.component';
import { TodayComponent } from './today/today.component';

export const routes: Routes = [
  { path: 'login', component: AuthComponent, canActivate: [signedOutGuard], data: { mode: 'login' }, title: 'Log in' },
  { path: 'register', component: AuthComponent, canActivate: [signedOutGuard], data: { mode: 'register' }, title: 'Create account' },
  { path: 'forgot', component: AuthComponent, canActivate: [signedOutGuard], data: { mode: 'forgot' }, title: 'Reset password' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [signedInGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'dashboard', redirectTo: 'today', pathMatch: 'full' },
      { path: 'today', component: TodayComponent, title: 'Today' },
      { path: 'habits', component: HomeComponent, title: 'Habits' },
      { path: 'habits/new', component: HabitWizardComponent, title: 'Add habit' },
      { path: 'habits/:id/edit', component: HabitWizardComponent, title: 'Edit habit' },
      { path: 'habits/:id', component: HabitDetailComponent, title: 'Habit' },
      { path: 'calendar', component: CalendarComponent, title: 'Calendar' },
      { path: 'stats', component: StatsComponent, title: 'Statistics' },
      { path: 'plan', component: PlanComponent, title: 'Plan' },
      { path: 'tasks', component: TasksComponent, title: 'Tasks' },
      { path: 'settings', component: SettingsComponent, title: 'Settings' },
      { path: '**', redirectTo: 'today' },
    ],
  },
];
