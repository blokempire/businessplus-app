CREATE TABLE `payment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userPhone` varchar(32) NOT NULL,
	`userName` varchar(255),
	`plan` enum('solo','team') NOT NULL,
	`amount` int NOT NULL,
	`paymentMethod` enum('mtn_momo','airtel_money','cash','whatsapp','other') NOT NULL,
	`transactionRef` varchar(255),
	`paymentStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`processedBy` int,
	`adminNote` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`)
);
