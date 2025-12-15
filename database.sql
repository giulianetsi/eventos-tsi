-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 10.129.76.12
-- Tempo de geração: 30/11/2025 às 15:17
-- Versão do servidor: 5.6.26-log
-- Versão do PHP: 8.0.15

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `pwa`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `groups_combined` tinyint(1) DEFAULT '0',
  `event_datetime` datetime DEFAULT NULL,
  `event_location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `target_user_types` text COLLATE utf8mb4_unicode_ci,
  `mostrar_data` tinyint(1) NOT NULL DEFAULT '1',
  `mostrar_apenas_na_data` tinyint(1) NOT NULL DEFAULT '0',
  `data_period_start` date DEFAULT NULL,
  `data_period_end` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `events`
--

INSERT INTO `events` (`id`, `title`, `description`, `type`, `user_id`, `is_public`, `groups_combined`, `event_datetime`, `event_location`, `created_at`, `target_user_types`, `mostrar_data`, `mostrar_apenas_na_data`, `data_period_start`, `data_period_end`) VALUES
(59, 'Reunião Geral', 'Reunião geral com todos os professores do câmpus.', 'reuniao', 11, 0, 0, '2025-11-30 10:00:00', 'Mini Auditório', '2025-11-28 13:23:28', '[\"teacher\"]', 1, 0, NULL, NULL),
(60, 'Palestra', 'Testando criação de evento com publico selecionado', 'palestra', 11, 0, 0, '2025-12-17 15:00:00', 'Auditório', '2025-11-28 23:47:37', '[\"student\"]', 1, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `event_groups`
--

CREATE TABLE `event_groups` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `event_groups`
--

INSERT INTO `event_groups` (`id`, `event_id`, `group_id`) VALUES
(5, 60, 10),
(4, 60, 13);

-- --------------------------------------------------------

--
-- Estrutura para tabela `groups`
--

CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `group_type` enum('turma','turno','area_ensino','curso','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'custom',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `groups`
--

INSERT INTO `groups` (`id`, `name`, `description`, `group_type`, `created_by`, `created_at`) VALUES
(10, 'Manhã', NULL, 'turno', NULL, '2025-11-28 11:47:46'),
(11, 'Tarde', NULL, 'turno', NULL, '2025-11-28 11:47:56'),
(12, 'Noite', NULL, 'custom', NULL, '2025-11-28 11:48:02'),
(13, 'Informática', NULL, 'curso', NULL, '2025-11-28 11:48:28'),
(14, 'Mecatrônica', NULL, 'curso', NULL, '2025-11-28 11:48:42'),
(15, 'Tecnologia de Sistemas para Internet', NULL, 'curso', NULL, '2025-11-28 11:48:59'),
(16, 'Engenharia de Controle e Automação', NULL, 'curso', NULL, '2025-11-28 11:49:22'),
(17, 'Pedagogia', NULL, 'curso', NULL, '2025-11-28 11:49:33');

-- --------------------------------------------------------

--
-- Estrutura para tabela `guardians`
--

CREATE TABLE `guardians` (
  `guardian_id` int(11) NOT NULL,
  `relationship` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `guardians`
--

INSERT INTO `guardians` (`guardian_id`, `relationship`, `student_id`) VALUES
(15, 'Mãe', 12);

-- --------------------------------------------------------

--
-- Estrutura para tabela `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) NOT NULL,
  `user_type_id` int(11) NOT NULL,
  `can_create_event` tinyint(1) DEFAULT '0',
  `can_view_all_events` tinyint(1) DEFAULT '0',
  `can_receive_notifications` tinyint(1) DEFAULT '1',
  `can_create_user` tinyint(1) DEFAULT '0',
  `can_manage_groups` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `permissions`
--

INSERT INTO `permissions` (`id`, `user_type_id`, `can_create_event`, `can_view_all_events`, `can_receive_notifications`, `can_create_user`) VALUES
(12, 2, 1, 0, 1, 0),
(13, 1, 1, 1, 1, 1),
(14, 3, 0, 0, 1, 0),
(15, 4, 0, 0, 1, 0);

-- --------------------------------------------------------

--
-- Estrutura para tabela `scheduled_notifications`
--

CREATE TABLE `scheduled_notifications` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `sent` tinyint(1) DEFAULT '0',
  `attempts` int(11) DEFAULT '0',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `last_attempt_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `scheduled_notifications`
--

INSERT INTO `scheduled_notifications` (`id`, `event_id`, `payload`, `scheduled_at`, `sent`, `attempts`, `last_error`, `last_attempt_at`, `created_at`) VALUES
(42, 59, '{\"title\":\"Novo evento\",\"body\":\"Um novo evento foi criado: Reunião Geral\",\"data\":{\"eventoId\":59}}', '2025-11-28 13:45:00', 1, 1, NULL, '2025-11-28 13:55:10', '2025-11-28 13:23:29');

-- --------------------------------------------------------

--
-- Estrutura para tabela `students`
--

CREATE TABLE `students` (
  `student_id` int(11) NOT NULL,
  `class` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registration_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `students`
--

INSERT INTO `students` (`student_id`, `class`, `registration_number`) VALUES
(12, '', '11111111111'),
(14, '', '8465135');

-- --------------------------------------------------------

--
-- Estrutura para tabela `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL,
  `endpoint` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `keys_p256dh` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `keys_auth` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `endpoint`, `keys_p256dh`, `keys_auth`, `user_id`) VALUES
(91, 'https://web.push.apple.com/QCt-CzPctizRfSojRz2scxv-DEciaw84pSqkdVyHL57Jvl9-XHYb7iKf-x9L0ewVkZkf0A8-whh2o-wqCEGdm0ur8J3wLpCvfzHwRpCCXLxBChReeaGE5kCrukUNe8vT5cs3PbTjHcWbA1Pl5FBtHjDz8pGX8DMIurTh2k_seAw', 'BJH7hxNCob1/AIdx1aHJbU6fhREUPFVkNsDkNYIsfCcxcVZZh4iyUUva2yX+qm8S1+9YSNL/I2Vx3eieLET38Mg=', '40GHol0N3J42sNM0aKuU4Q==', 12),
(92, 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABpJ5B4jvVf093q1bWuU4UWSNgDreMEzZAbHW9xE65lIrwnm8v-lFqy0k4W_GVIYz1_9OjWbbjLAU-uIcCAbpx3FIYRCkPcBdVkDUNPQbpDUUeEt_T6_GrOECgHvToS9VK8YwHI5FALTlCeqgKqlfX3khJfi2XhKFPX762ae8Oq8IIn76Y', 'BD/LJMFkvOHpNrLMOlJ7TxgSndcFil9jgUiMfWgcvAPJ0Ekgkww3ETJ/S6fKjlHz7mIPaS2ozOLNNNZ54sczbh4=', 'p20MsRDaM3jvMa1rjC10Qg==', 13),
(97, 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABpJ5B4jvVf093q1bWuU4UWSNgDreMEzZAbHW9xE65lIrwnm8v-lFqy0k4W_GVIYz1_9OjWbbjLAU-uIcCAbpx3FIYRCkPcBdVkDUNPQbpDUUeEt_T6_GrOECgHvToS9VK8YwHI5FALTlCeqgKqlfX3khJfi2XhKFPX762ae8Oq8IIn76Y', 'BD/LJMFkvOHpNrLMOlJ7TxgSndcFil9jgUiMfWgcvAPJ0Ekgkww3ETJ/S6fKjlHz7mIPaS2ozOLNNNZ54sczbh4=', 'p20MsRDaM3jvMa1rjC10Qg==', 13),
(100, 'https://web.push.apple.com/QMQa8tnuRkAzhYex5xB3yq6rJH89Zj7MUj2K4NKDKPb0bhTyV8J8melzcm-4fjxIXbtGWl-iRIgapCQzv05aaIMHMAAxN8FNCE9bPVnMFNlYo7sLmQC-9OarJkEg3YW5a3Q0wBRJL1AZslLZuHnJWVF4ZLxfPV45RiPkxCypkoA', 'BKmQBfr7rdiUZ435vtRPP0M8xzUBN+oUKigUyDq85x3nMHAsmM65L5Y4sfWK++d2qAxiDfVaBJVNzukPB7D4Y9Q=', 'pUFcGmT35xouzu5z4ceS7A==', 12),
(101, 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABpJ5B4jvVf093q1bWuU4UWSNgDreMEzZAbHW9xE65lIrwnm8v-lFqy0k4W_GVIYz1_9OjWbbjLAU-uIcCAbpx3FIYRCkPcBdVkDUNPQbpDUUeEt_T6_GrOECgHvToS9VK8YwHI5FALTlCeqgKqlfX3khJfi2XhKFPX762ae8Oq8IIn76Y', 'BD/LJMFkvOHpNrLMOlJ7TxgSndcFil9jgUiMfWgcvAPJ0Ekgkww3ETJ/S6fKjlHz7mIPaS2ozOLNNNZ54sczbh4=', 'p20MsRDaM3jvMa1rjC10Qg==', 14),
(102, 'https://web.push.apple.com/QMQa8tnuRkAzhYex5xB3yq6rJH89Zj7MUj2K4NKDKPb0bhTyV8J8melzcm-4fjxIXbtGWl-iRIgapCQzv05aaIMHMAAxN8FNCE9bPVnMFNlYo7sLmQC-9OarJkEg3YW5a3Q0wBRJL1AZslLZuHnJWVF4ZLxfPV45RiPkxCypkoA', 'BKmQBfr7rdiUZ435vtRPP0M8xzUBN+oUKigUyDq85x3nMHAsmM65L5Y4sfWK++d2qAxiDfVaBJVNzukPB7D4Y9Q=', 'pUFcGmT35xouzu5z4ceS7A==', 11),
(103, 'https://web.push.apple.com/QMQa8tnuRkAzhYex5xB3yq6rJH89Zj7MUj2K4NKDKPb0bhTyV8J8melzcm-4fjxIXbtGWl-iRIgapCQzv05aaIMHMAAxN8FNCE9bPVnMFNlYo7sLmQC-9OarJkEg3YW5a3Q0wBRJL1AZslLZuHnJWVF4ZLxfPV45RiPkxCypkoA', 'BKmQBfr7rdiUZ435vtRPP0M8xzUBN+oUKigUyDq85x3nMHAsmM65L5Y4sfWK++d2qAxiDfVaBJVNzukPB7D4Y9Q=', 'pUFcGmT35xouzu5z4ceS7A==', 11),
(104, 'https://web.push.apple.com/QMQa8tnuRkAzhYex5xB3yq6rJH89Zj7MUj2K4NKDKPb0bhTyV8J8melzcm-4fjxIXbtGWl-iRIgapCQzv05aaIMHMAAxN8FNCE9bPVnMFNlYo7sLmQC-9OarJkEg3YW5a3Q0wBRJL1AZslLZuHnJWVF4ZLxfPV45RiPkxCypkoA', 'BKmQBfr7rdiUZ435vtRPP0M8xzUBN+oUKigUyDq85x3nMHAsmM65L5Y4sfWK++d2qAxiDfVaBJVNzukPB7D4Y9Q=', 'pUFcGmT35xouzu5z4ceS7A==', 11),
(107, 'https://web.push.apple.com/QODcDsVs2kFAlNia-CM_pcfbfAudcNpiY-JH2C37cUfefkEUut6lGhxQ2Q_idNJcuP9abe96s6SVI70wEkqc7_PTA-PhHONFmuic8wXto2l5VjxyrY6KprBBu1lis0hXaY0TIv0pDyRIdc37VU27vuoFYcOwEoAWoHoar53Ak_w', 'BLVuKSnIo/RrujsoUgicIDv7cjoSsE7V7DLIsBhKHzEAJ0GM2C3tbj/AhXcgKeuqWOmGAdrfGjryOr/2VGsw0J0=', 'Ai/HIA5rqKy9hqVphD9zpw==', 14),
(108, 'https://web.push.apple.com/QODcDsVs2kFAlNia-CM_pcfbfAudcNpiY-JH2C37cUfefkEUut6lGhxQ2Q_idNJcuP9abe96s6SVI70wEkqc7_PTA-PhHONFmuic8wXto2l5VjxyrY6KprBBu1lis0hXaY0TIv0pDyRIdc37VU27vuoFYcOwEoAWoHoar53Ak_w', 'BLVuKSnIo/RrujsoUgicIDv7cjoSsE7V7DLIsBhKHzEAJ0GM2C3tbj/AhXcgKeuqWOmGAdrfGjryOr/2VGsw0J0=', 'Ai/HIA5rqKy9hqVphD9zpw==', 14),
(109, 'https://web.push.apple.com/QODcDsVs2kFAlNia-CM_pcfbfAudcNpiY-JH2C37cUfefkEUut6lGhxQ2Q_idNJcuP9abe96s6SVI70wEkqc7_PTA-PhHONFmuic8wXto2l5VjxyrY6KprBBu1lis0hXaY0TIv0pDyRIdc37VU27vuoFYcOwEoAWoHoar53Ak_w', 'BLVuKSnIo/RrujsoUgicIDv7cjoSsE7V7DLIsBhKHzEAJ0GM2C3tbj/AhXcgKeuqWOmGAdrfGjryOr/2VGsw0J0=', 'Ai/HIA5rqKy9hqVphD9zpw==', 11),
(110, 'https://web.push.apple.com/QODcDsVs2kFAlNia-CM_pcfbfAudcNpiY-JH2C37cUfefkEUut6lGhxQ2Q_idNJcuP9abe96s6SVI70wEkqc7_PTA-PhHONFmuic8wXto2l5VjxyrY6KprBBu1lis0hXaY0TIv0pDyRIdc37VU27vuoFYcOwEoAWoHoar53Ak_w', 'BLVuKSnIo/RrujsoUgicIDv7cjoSsE7V7DLIsBhKHzEAJ0GM2C3tbj/AhXcgKeuqWOmGAdrfGjryOr/2VGsw0J0=', 'Ai/HIA5rqKy9hqVphD9zpw==', 11),
(125, 'https://web.push.apple.com/QIZivKUCDcLQFpMPBjsa5zByydUuB1ZuBI0bZBYD6b6oUeCzlGOlMq3WmdPISG446hwFrGJkym4Agr8Vu2Y-Obt2eRvbDp_wFB373xr_uWPVge2-dNQoJaBjhPVMcvdzIRLPdjgO04EhK8a7Mq4J4Ilpq71JgeqssXcQPABfhaU', 'BBNkTywKJhWGjuvlS/NWC0pkeDhy70WTEKUDOWF4MB+PSjqXEjIYqd0PHU7MCErbGEGaowou1IKNpeCppBTwWoc=', 'Mco8MhlxP+yflgwODCnbQQ==', 12),
(126, 'https://web.push.apple.com/QIZivKUCDcLQFpMPBjsa5zByydUuB1ZuBI0bZBYD6b6oUeCzlGOlMq3WmdPISG446hwFrGJkym4Agr8Vu2Y-Obt2eRvbDp_wFB373xr_uWPVge2-dNQoJaBjhPVMcvdzIRLPdjgO04EhK8a7Mq4J4Ilpq71JgeqssXcQPABfhaU', 'BBNkTywKJhWGjuvlS/NWC0pkeDhy70WTEKUDOWF4MB+PSjqXEjIYqd0PHU7MCErbGEGaowou1IKNpeCppBTwWoc=', 'Mco8MhlxP+yflgwODCnbQQ==', 12),
(138, 'https://fcm.googleapis.com/fcm/send/dVAvWePEXEI:APA91bE1fr0vUsjbUaoxCcdMCr37V1W3Uoa-biYF976CXPL_tQIquU9Q6v3x2DMgmZSJAzN6wff0iqLqRmyqknv_EdkkHO3eKLKEh8Rxx-0aPThD-_zC4dbIkHAkWcLibpygPMAqfoGP', 'BHGrKZRB2Kv2hKasXZdiznVFWEUL6ikEEm/N8F39vt5yt8B4DD2JYQNuDCl6lYjTw+PM7i5E86gS+E1qRTG1h+k=', 'eautGWI2JSzrjw1xkZjC5g==', 11);

-- --------------------------------------------------------

--
-- Estrutura para tabela `teachers`
--

CREATE TABLE `teachers` (
  `teacher_id` int(11) NOT NULL,
  `courses` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `teachers`
--

INSERT INTO `teachers` (`teacher_id`, `courses`) VALUES
(13, '');

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cpf` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `phone`, `birth_date`, `password`, `cpf`, `user_type_id`, `created_at`) VALUES
(11, 'Admin', 'Sistema', 'admin@admin.com', '51995721811', NULL, '$2a$10$4TL3TbbI3e7NuYGRpM5tyuq8AH3bvloHsjms0gCs8dzwVMApDJSMa', '12345678909', 1, '2025-11-25 23:25:27'),
(12, 'aluno', 'teste', 'aluno@aluno.com', '5199999999', '2000-01-01', '$2a$10$IAqdu8u7zRLYIWVtOz4dquVUkTALbH/VJus35ffXbRtmEzlLqd1sa', '11111111111', 3, '2025-11-25 23:26:35'),
(13, 'prof', 'prof', 'prof@prof.com', '51888888888', '1995-01-01', '$2a$10$USXzeh7bjPLSrgoag4zCNOZVgJiydxQfCFhbuatwfKQ4lXC1lq6v2', '1234567895', 2, '2025-11-26 22:12:26'),
(14, 'aluno2', 'aluno2', 'aluno2@aluno.com', '654646553', '2000-01-01', '$2a$10$pDACqtlQQ5s1suSnLEuZj.xH/UyiiGNS48IGi0f/3POpWKUV6LkBW', '84512045120', 3, '2025-11-27 02:30:16'),
(15, 'Responsável', 'teste', 'resp@resp.com', '519879879879', '1985-10-10', '$2a$10$5.NSIisZpS1K9XICItDCTet5dXSuKrFC9Bmm3OjqL5MoxrXMbMSbC', '12345852741', 4, '2025-11-28 23:49:39');

-- --------------------------------------------------------

--
-- Estrutura para tabela `user_groups`
--

CREATE TABLE `user_groups` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `user_groups`
--

INSERT INTO `user_groups` (`id`, `user_id`, `group_id`, `joined_at`) VALUES
(7, 12, 13, '2025-11-28 11:49:54'),
(8, 12, 10, '2025-11-28 11:50:16');

-- --------------------------------------------------------

--
-- Estrutura para tabela `user_types`
--

CREATE TABLE `user_types` (
  `id` int(11) NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `user_types`
--

INSERT INTO `user_types` (`id`, `name`, `description`) VALUES
(1, 'admin', 'Administrador do sistema'),
(2, 'teacher', 'Professor'),
(3, 'student', 'Estudante'),
(4, 'guardian', 'Responsável');

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_events_user_id` (`user_id`);

--
-- Índices de tabela `event_groups`
--
ALTER TABLE `event_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_event_groups_event_group` (`event_id`,`group_id`),
  ADD KEY `ix_event_groups_group_id` (`group_id`);

--
-- Índices de tabela `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_groups_created_by` (`created_by`);

--
-- Índices de tabela `guardians`
--
ALTER TABLE `guardians`
  ADD PRIMARY KEY (`guardian_id`),
  ADD KEY `ix_guardians_student_id` (`student_id`);

--
-- Índices de tabela `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_permissions_user_type_id` (`user_type_id`);

--
-- Índices de tabela `scheduled_notifications`
--
ALTER TABLE `scheduled_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `scheduled_notifications_ibfk_1` (`event_id`);

--
-- Índices de tabela `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`student_id`),
  ADD UNIQUE KEY `ux_students_registration_number` (`registration_number`);

--
-- Índices de tabela `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_subscriptions_user_id` (`user_id`);

--
-- Índices de tabela `teachers`
--
ALTER TABLE `teachers`
  ADD PRIMARY KEY (`teacher_id`);

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_users_email` (`email`),
  ADD UNIQUE KEY `ux_users_cpf` (`cpf`),
  ADD KEY `ix_users_user_type_id` (`user_type_id`);

--
-- Índices de tabela `user_groups`
--
ALTER TABLE `user_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_user_groups_user_group` (`user_id`,`group_id`),
  ADD KEY `ix_user_groups_group_id` (`group_id`);

--
-- Índices de tabela `user_types`
--
ALTER TABLE `user_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_user_types_name` (`name`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT de tabela `event_groups`
--
ALTER TABLE `event_groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT de tabela `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de tabela `scheduled_notifications`
--
ALTER TABLE `scheduled_notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT de tabela `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=139;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de tabela `user_groups`
--
ALTER TABLE `user_groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de tabela `user_types`
--
ALTER TABLE `user_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `event_groups`
--
ALTER TABLE `event_groups`
  ADD CONSTRAINT `event_groups_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `event_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `groups`
--
ALTER TABLE `groups`
  ADD CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `guardians`
--
ALTER TABLE `guardians`
  ADD CONSTRAINT `guardians_ibfk_1` FOREIGN KEY (`guardian_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `guardians_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `permissions`
--
ALTER TABLE `permissions`
  ADD CONSTRAINT `permissions_ibfk_1` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `scheduled_notifications`
--
ALTER TABLE `scheduled_notifications`
  ADD CONSTRAINT `scheduled_notifications_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `students`
--
ALTER TABLE `students`
  ADD CONSTRAINT `students_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `teachers`
--
ALTER TABLE `teachers`
  ADD CONSTRAINT `teachers_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`);

--
-- Restrições para tabelas `user_groups`
--
ALTER TABLE `user_groups`
  ADD CONSTRAINT `user_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
