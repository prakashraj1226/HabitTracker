import { Routes } from '@angular/router';
import { CalendarComponent } from './calendar/calendar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HabitDetailsComponent } from './habit/habit-details/habit-details.component';
import { HabitFormComponent } from './habit/habit-form/habit-form.component';
import { HabitListComponent } from './habit/habit-list/habit-list.component';
import { ShellComponent } from './layout/shell/shell.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard · Habit Tracker' },
      { path: 'habits', component: HabitListComponent, title: 'Habits · Habit Tracker' },
      { path: 'habits/new', component: HabitFormComponent, title: 'Add habit · Habit Tracker' },
      { path: 'habits/:id/edit', component: HabitFormComponent, title: 'Edit habit · Habit Tracker' },
      { path: 'habits/:id', component: HabitDetailsComponent, title: 'Habit · Habit Tracker' },
      { path: 'calendar', component: CalendarComponent, title: 'Calendar · Habit Tracker' },
      { path: 'settings', component: SettingsComponent, title: 'Settings · Habit Tracker' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
