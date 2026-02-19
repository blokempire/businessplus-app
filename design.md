# Ledger App — Mobile Interface Design

## App Overview

A simple, offline-first mobile accounting ledger designed for small and micro-businesses in underdeveloped markets. The app replaces paper notebooks with a clean digital tool for tracking income, expenses, and generating financial insights.

## Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| primary | #0D9488 (teal-600) | #14B8A6 (teal-500) | Buttons, active tabs, accent |
| background | #FFFFFF | #0F172A | Screen backgrounds |
| surface | #F0FDFA (teal-50) | #1E293B | Cards, elevated surfaces |
| foreground | #0F172A | #F1F5F9 | Primary text |
| muted | #64748B | #94A3B8 | Secondary text, labels |
| border | #E2E8F0 | #334155 | Dividers, card borders |
| success | #22C55E | #4ADE80 | Income indicators |
| warning | #F59E0B | #FBBF24 | Warning states |
| error | #EF4444 | #F87171 | Expense indicators, errors |

## Screen List

### 1. Dashboard (Home Tab)
- **Header**: Business name + current date
- **Balance Card**: Large net balance display with income/expense totals below
- **Quick Actions**: Two large buttons — "+ Income" and "- Expense"
- **Recent Transactions**: Last 5 transactions as a compact list (icon, description, amount, date)
- **Monthly Summary Mini-Chart**: Small bar chart showing last 7 days

### 2. Transactions Tab
- **Filter Bar**: Toggle between All / Income / Expense + date range picker
- **Transaction List**: FlatList with grouped headers by date, each item shows category icon, description, amount (green for income, red for expense), and time
- **Floating Action Button**: "+" to add new transaction
- **Swipe Actions**: Swipe left to delete, swipe right to edit

### 3. Add/Edit Transaction Screen (Modal)
- **Type Selector**: Toggle between Income / Expense at top
- **Amount Input**: Large numeric input with currency symbol
- **Category Picker**: Grid of category icons (scrollable)
- **Description**: Optional text input
- **Date Picker**: Defaults to today, tap to change
- **Save Button**: Full-width teal button at bottom

### 4. Reports Tab
- **Period Selector**: Daily / Weekly / Monthly / Yearly tabs
- **Summary Cards**: Income total, Expense total, Net balance for selected period
- **Bar Chart**: Income vs Expense comparison over time
- **Pie Chart**: Expense breakdown by category
- **Category List**: Ranked list of categories by spending amount

### 5. Settings Tab
- **Profile Section**: User name, business name
- **Language Switcher**: French / English toggle
- **Currency Setting**: Select local currency
- **Categories Management**: View/add/edit custom categories
- **Data Export**: Export transactions as CSV
- **About**: App version, credits

### 6. Categories Management Screen
- **Category List**: All categories with icons, grouped by Income/Expense
- **Add Category**: Name + icon picker + type (income/expense)
- **Edit/Delete**: Tap to edit, long-press to delete

### 7. User Authentication Screens
- **Login Screen**: Email + password fields, login button, "Create Account" link
- **Register Screen**: Name, business name, email, password fields
- **Simple design**: Teal gradient header with app logo

## Key User Flows

### Flow 1: Record a Transaction
1. User opens app → Dashboard
2. Taps "+ Income" or "- Expense" quick action
3. Enters amount on numeric keypad
4. Selects category from grid
5. Optionally adds description
6. Taps "Save" → Returns to Dashboard with updated balance

### Flow 2: View Reports
1. User taps Reports tab
2. Selects time period (Weekly)
3. Views bar chart of income vs expenses
4. Scrolls to pie chart for category breakdown
5. Taps a category to see filtered transactions

### Flow 3: Change Language
1. User taps Settings tab
2. Taps Language option
3. Selects French or English
4. App immediately switches all text

### Flow 4: Manage Categories
1. User taps Settings → Categories
2. Views existing categories
3. Taps "+" to add new category
4. Enters name, picks icon, selects type
5. Saves → Category available in transaction form

## Layout Principles

- **Mobile portrait (9:16)** orientation only
- **One-handed usage**: All primary actions reachable with thumb
- **Large touch targets**: Minimum 48x48dp for all interactive elements
- **Clear visual hierarchy**: Balance is the hero element on dashboard
- **Offline-first**: All features work without internet
- **Low literacy friendly**: Heavy use of icons alongside text labels
