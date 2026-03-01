CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`nameKey` varchar(255) NOT NULL,
	`icon` varchar(64) NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`isCustom` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `debt_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`contactId` varchar(64) NOT NULL,
	`type` enum('theyOweMe','iOweThem') NOT NULL,
	`amount` double NOT NULL,
	`description` text,
	`date` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `debt_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`contactId` varchar(64) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`items` json NOT NULL,
	`subtotal` double NOT NULL DEFAULT 0,
	`discountType` enum('value','percentage') NOT NULL DEFAULT 'value',
	`discountValue` double NOT NULL DEFAULT 0,
	`discountAmount` double NOT NULL DEFAULT 0,
	`tax` double NOT NULL DEFAULT 0,
	`total` double NOT NULL DEFAULT 0,
	`invoiceStatus` enum('pending','paid','partial','cancelled') NOT NULL DEFAULT 'pending',
	`paidAmount` double NOT NULL DEFAULT 0,
	`date` varchar(64) NOT NULL,
	`dueDate` varchar(64),
	`note` text,
	`photoUris` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` double NOT NULL DEFAULT 0,
	`quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(32) NOT NULL DEFAULT 'pcs',
	`photoUri` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(64) NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` double NOT NULL,
	`categoryId` varchar(64) NOT NULL,
	`description` text,
	`date` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`businessName` varchar(255),
	`currency` varchar(10) NOT NULL DEFAULT 'XAF',
	`language` varchar(5) NOT NULL DEFAULT 'fr',
	`logoUri` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
