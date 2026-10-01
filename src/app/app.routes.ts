import { Routes } from '@angular/router';
import { HabitDetailComponent } from './habit/habit-detail/habit-detail.component';
import { HabitWizardComponent } from './habit/habit-wizard/habit-wizard.component';
import { HomeComponent } from './home/home.component';
import { ShellComponent } from './layout/shell/shell.component';
import { PlanComponent } from './plan/plan.component';
import { SettingsComponent } from './settings/settings.component';
import { TasksComponent } from './tasks/tasks.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'habits' },
      { path: 'dashboard', redirectTo: 'habits', pathMatch: 'full' },
      { path: 'calendar', redirectTo: 'habits', pathMatch: 'full' },
      { path: 'habits', component: HomeComponent, title: 'Habits' },
      { path: 'habits/new', component: HabitWizardComponent, title: 'Add habit' },
      { path: 'habits/:id/edit', component: HabitWizardComponent, title: 'Edit habit' },
      { path: 'habits/:id', component: HabitDetailComponent, title: 'Habit' },
      { path: 'plan', component: PlanComponent, title: 'Plan' },
      { path: 'tasks', component: TasksComponent, title: 'Tasks' },
      { path: 'settings', component: SettingsComponent, title: 'Settings' },
      { path: '**', redirectTo: 'habits' },
    ],
  },
];
