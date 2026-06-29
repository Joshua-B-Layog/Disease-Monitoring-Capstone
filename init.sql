-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 23, 2026 at 02:51 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `cabuyao_cdms_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `barangays`
--

CREATE TABLE `barangays` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `barangays`
--

INSERT INTO `barangays` (`id`, `name`) VALUES
(1, 'Baclaran'),
(2, 'Banay-Banay'),
(3, 'Banlic'),
(4, 'Barangay Uno (Poblacion)'),
(5, 'Barangay Dos (Poblacion)'),
(6, 'Barangay Tres (Poblacion)'),
(7, 'Bigaa'),
(8, 'Butong'),
(9, 'Casile'),
(10, 'Diezmo'),
(11, 'Gulod'),
(12, 'Mamatid'),
(13, 'Marinig'),
(14, 'Niugan'),
(15, 'Pittland'),
(16, 'Pulo'),
(17, 'Sala'),
(18, 'San Isidro');

-- --------------------------------------------------------

--
-- Table structure for table `diseases`
--

CREATE TABLE `diseases` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `diseases`
--

INSERT INTO `diseases` (`id`, `name`) VALUES
(3, 'Acute Respiratory Infection'),
(4, 'Avian Influenza'),
(5, 'Chickenpox'),
(6, 'Cholera'),
(8, 'Covid-19'),
(7, 'Dengue'),
(9, 'Diphtheria'),
(10, 'Ebola'),
(11, 'Hand Foot and Mouth Disease'),
(12, 'Hepatitis A'),
(13, 'Hepatitis B'),
(14, 'Hepatitis C'),
(15, 'HIV/AIDS'),
(16, 'Influenza'),
(17, 'Influenza A (H1N1)'),
(18, 'Leprosy'),
(19, 'Malaria'),
(20, 'Measles'),
(21, 'Meningococcemia'),
(22, 'Pertussis'),
(23, 'Poliomyelitis'),
(24, 'Rabies'),
(25, 'SARS'),
(26, 'Sore Eyes'),
(1, 'Tuberculosis'),
(2, 'Typhoid Fever');

-- --------------------------------------------------------

--
-- Table structure for table `disease_cases`
--

CREATE TABLE `disease_cases` (
  `case_id` int(11) NOT NULL,
  `patient_name` varchar(100) DEFAULT NULL,
  `barangay_id` int(11) NOT NULL,
  `status` enum('Active','Pending','Approved','Recovered','Deceased','Under Treatment','Draft') DEFAULT 'Active',
  `date_reported` timestamp NOT NULL DEFAULT current_timestamp(),
  `disease_id` int(11) DEFAULT NULL,
  `severity` varchar(50) DEFAULT NULL,
  `age` int(3) NOT NULL,
  `gender` varchar(10) DEFAULT 'Male',
  `contact` varchar(20) DEFAULT NULL,
  `onset_date` date DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `symptoms` text DEFAULT NULL,
  `physician` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,6) DEFAULT NULL,
  `longitude` decimal(10,6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `disease_cases`
--

INSERT INTO `disease_cases` (`case_id`, `patient_name`, `barangay_id`, `status`, `date_reported`, `disease_id`, `severity`, `age`, `gender`, `contact`, `onset_date`, `address`, `symptoms`, `physician`, `latitude`, `longitude`) VALUES
(1, 'Juan Dela Cruz', 1, 'Active', '2026-05-28 01:02:58', 1, 'Severe', 24, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'Maria Santos', 2, 'Active', '2026-05-28 01:02:58', 1, 'Moderate', 15, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 'Pedro Reyes', 3, 'Active', '2026-05-28 01:02:58', 1, 'Mild', 19, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'Ana Lim', 1, 'Active', '2026-05-28 01:02:58', 2, 'Asymptomatic', 35, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 'Lim Anthony', 4, 'Active', '2026-05-28 01:02:58', 2, 'Asymptomatic', 20, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(6, 'Kara Leam', 2, 'Active', '2026-05-28 01:02:58', 6, 'Asymptomatic', 28, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(7, 'Anastasia Kim', 2, 'Active', '2026-05-28 01:02:58', 6, 'Asymptomatic', 57, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(8, 'Pang Subaru', 5, 'Active', '2026-05-28 01:02:58', 6, 'Asymptomatic', 34, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(9, 'Limuel Sam', 1, 'Under Treatment', '2026-05-28 01:02:58', 7, 'Asymptomatic', 9, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(10, 'Apprel Kia', 3, 'Active', '2026-05-28 01:02:58', 8, 'Asymptomatic', 17, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(11, 'John Smith', 6, 'Deceased', '2026-05-28 01:02:58', 8, 'Asymptomatic', 42, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(12, 'Kara Touche', 2, 'Active', '2026-05-28 01:02:58', 9, 'Asymptomatic', 21, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(13, 'Limuel Sam', 15, 'Recovered', '2026-06-16 01:27:36', 7, 'Moderate', 21, 'Male', '09445651201', NULL, '992 Niugan Cabuyao City Laguna', 'dasdadasda', 'Dr. Jose Reyes', 14.263300, 121.127300);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `role` enum('CHO','BHW') NOT NULL,
  `assigned_barangay_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email` varchar(255) DEFAULT NULL,
  `mobile_number` varchar(20) DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `token_expiry` datetime DEFAULT NULL,
  `otp_code` varchar(6) DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `last_login_location` varchar(255) DEFAULT NULL,
  `last_login_device` varchar(255) DEFAULT NULL,
  `previous_login` datetime DEFAULT NULL,
  `previous_login_location` varchar(255) DEFAULT NULL,
  `previous_login_device` varchar(255) DEFAULT NULL,
  `two_fa_enabled` tinyint(1) DEFAULT 0,
  `two_fa_token` varchar(255) DEFAULT NULL,
  `two_fa_token_expiry` datetime DEFAULT NULL,
  `login_otp` varchar(6) DEFAULT NULL,
  `login_otp_expiry` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password`, `full_name`, `role`, `assigned_barangay_id`, `is_active`, `email`, `mobile_number`, `reset_token`, `token_expiry`, `otp_code`, `last_login`, `last_login_location`, `last_login_device`, `previous_login`, `previous_login_location`, `previous_login_device`, `two_fa_enabled`, `two_fa_token`, `two_fa_token_expiry`, `login_otp`, `login_otp_expiry`) VALUES
(1, 'bhw_mamatid', 'password123', 'Maria Santos', 'BHW', 13, 1, 'joshling212@gmail.com', '09452241253', '7cf84040afbe9e2965a4e7bdb7ea44c2e67cfa7487b1f6d6856bd9cb215da371', '2026-06-13 13:14:04', '172698', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(2, 'cho_niugan', 'test123', 'John Carl', 'CHO', 15, 1, 'idkwutishappen@gmail.com', '09478891074', 'c2e7132cb0f4a4a2be6cab431d27b1e707496fa35ec36f8b9b24467caf29d386', '2026-06-11 13:37:02', '699769', '2026-06-23 10:09:45', 'Cabuyao, Calabarzon, Philippines', 'Chrome on Windows', '2026-06-23 10:03:56', 'Cabuyao, Calabarzon, Philippines', 'Chrome on Windows', 0, NULL, NULL, NULL, NULL),
(6, 'jese', 'test', 'jses', 'BHW', 8, 1, 'jese@gmail.com', '09635355201', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(7, 'test', 'test1', 'test', 'BHW', 5, 1, 'test@gmail.com', '09556212374', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(8, 'weq', '58b17aa4', 'asda dasd', 'BHW', 11, 1, 'sda@gmail.com', '09442241520', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
(9, 'pohai', '184acad5', 'Kyle Lantern', 'CHO', 10, 1, 'joshling212@gmail.com', '09566423158', NULL, NULL, NULL, '2026-06-23 10:10:44', 'Cabuyao, Calabarzon, Philippines', 'Chrome on Windows', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL);



CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  title VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  link_to VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);



CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  cho_unit VARCHAR(100),
  barangay VARCHAR(100),
  action VARCHAR(50),
  entity VARCHAR(100),
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS generated_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  period VARCHAR(50),
  entity VARCHAR(100),
  details TEXT,
  cho_unit VARCHAR(100),
  snapshot_logs JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--
-- Indexes for dumped tables
--

--
-- Indexes for table `barangays`
--
ALTER TABLE `barangays`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `diseases`
--
ALTER TABLE `diseases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_disease_name` (`name`);

--
-- Indexes for table `disease_cases`
--
ALTER TABLE `disease_cases`
  ADD PRIMARY KEY (`case_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`);



--
-- Indexes for table `generated_reports`
--
ALTER TABLE `generated_reports`
  ADD PRIMARY KEY (`id`);



--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `barangays`
--
ALTER TABLE `barangays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `diseases`
--
ALTER TABLE `diseases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90;

--
-- AUTO_INCREMENT for table `disease_cases`
--
ALTER TABLE `disease_cases`
  MODIFY `case_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;
COMMIT;

--
-- AUTO_INCREMENT for table `generated_reports`
--
ALTER TABLE `generated_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
