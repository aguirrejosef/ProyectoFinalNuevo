-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 19-10-2025 a las 01:55:00
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `padel`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `canchas`
--

CREATE TABLE `canchas` (
  `id_cancha` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `ubicacion` varchar(100) NOT NULL,
  `estado` enum('disponible','mantenimiento') DEFAULT 'disponible',
  `id_club` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `canchas`
--

INSERT INTO `canchas` (`id_cancha`, `nombre`, `ubicacion`, `estado`, `id_club`) VALUES
(1, 'Cancha 1', 'Alem 1200', 'disponible', 1),
(2, 'Cancha 2', 'Alem 1200', 'disponible', 1),
(3, 'Cancha 3', 'Alem 1200', 'disponible', 1),
(4, 'Cancha 4', 'Alem 1200', 'disponible', 1),
(5, 'Cancha 5', 'Alem 1200', 'disponible', 1),
(6, 'Cancha 1', 'Aconquija 2304', 'disponible', 2),
(7, 'Cancha 2', 'Aconquija 2304', 'disponible', 2),
(8, 'Cancha 3', 'Aconquija 2304', 'disponible', 2),
(9, 'Cancha 4', 'Aconquija 2304', 'disponible', 2),
(10, 'Cancha 5', 'Aconquija 2304', 'disponible', 2),
(11, 'Cancha 1', 'Suispacha 1234', 'disponible', 3),
(12, 'Cancha 2', 'Suispacha 1234', 'disponible', 3),
(13, 'Cancha 3', 'Suispacha 1234', 'disponible', 3),
(14, 'Cancha 4', 'Suispacha 1234', 'disponible', 3),
(15, 'Cancha 5', 'Suispacha 1234', 'disponible', 3),
(16, 'Cancha 1', 'Roca 1200', 'disponible', 4),
(17, 'Cancha 2', 'Roca 1200', 'disponible', 4),
(18, 'Cancha 3', 'Roca 1200', 'disponible', 4),
(19, 'Cancha 4', 'Roca 1200', 'disponible', 4),
(20, 'Cancha 5', 'Roca 1200', 'disponible', 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `club`
--

CREATE TABLE `club` (
  `id_club` int(11) NOT NULL,
  `nombreClub` varchar(100) NOT NULL,
  `nombreTitular` varchar(100) NOT NULL,
  `nroTitular` varchar(20) DEFAULT NULL,
  `edad` int(11) DEFAULT NULL,
  `nroClub` varchar(20) NOT NULL,
  `localidad` varchar(100) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `canchas` int(11) DEFAULT 0,
  `correo` varchar(100) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `club`
--

INSERT INTO `club` (`id_club`, `nombreClub`, `nombreTitular`, `nroTitular`, `edad`, `nroClub`, `localidad`, `direccion`, `canchas`, `correo`, `usuario`, `password`) VALUES
(1, 'Italia Padel', 'Aguirre Jose ', '3815542302', 30, '42129', 'San Miguel de Tucumán', 'Alem 1200', 5, 'italiapadel@gmail.com', 'italiapadel', '$2a$10$spFrutezyDUIE.VjweYQ3e1zA9BsJn1EQHzpPcR6MwssdmHsn7NEa'),
(2, 'Mad Padel', 'Castro Priscila', '3814562352', 29, '4523685', 'Yerba Buena', 'Aconquija 2304', 5, 'madpadel@gmail.com', 'madpadel', '$2a$10$74QtcFHJ4NM5mkoYK5nqhOa/grLcsDgvtos.2YRrrSkkXGPCfmK6C'),
(3, 'Alemania Padel', 'Cruz Cristian', '3812358978', 35, '4521478', 'San Miguel de Tucumán', 'Suispacha 1234', 5, 'alemaniapadel@gmail.com', 'alemaniapadel', '$2a$10$PLPKvQhziSVtwHAWlUOXBOzkmFKXxzFEQAnLlwCvkyBKS1piPP9Se'),
(4, 'Tafi Padel', 'Naranjo Jose', '3814567812', 40, '4278956', 'Tafí Viejo', 'Roca 1200', 5, 'tafipadel@gmail.com', 'tafipadel', '$2a$10$xmYZAdBgeV4V.IwRrz0C8OeM1djfGkdQxIAoWd6D05IVJWuGdJAp6');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id_usuario` int(11) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `metodo_registro` enum('manual','google','facebook') NOT NULL DEFAULT 'manual',
  `rol` enum('admin','club','cliente') NOT NULL DEFAULT 'cliente',
  `id_club` int(11) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id_usuario`, `usuario`, `correo`, `password`, `metodo_registro`, `rol`, `id_club`, `creado_en`) VALUES
(1, 'admin', 'admin@padel.com', '$2a$10$eQElQZ691q4x.VMeGGVhvu5AUc2DDzE1/e3S8gBOBB1sHs0K1Ti.6', 'manual', 'admin', NULL, '2025-09-13 23:34:38'),
(2, 'Adriana Woods', 'adrianawoods3@gmail.com', '', 'google', 'cliente', NULL, '2025-09-13 23:36:50'),
(3, 'italiapadel', 'italiapadel@gmail.com', '$2a$10$spFrutezyDUIE.VjweYQ3e1zA9BsJn1EQHzpPcR6MwssdmHsn7NEa', 'manual', 'club', NULL, '2025-09-13 23:40:07'),
(4, 'madpadel', 'madpadel@gmail.com', '$2a$10$74QtcFHJ4NM5mkoYK5nqhOa/grLcsDgvtos.2YRrrSkkXGPCfmK6C', 'manual', 'club', NULL, '2025-09-13 23:41:21'),
(5, 'alemaniapadel', 'alemaniapadel@gmail.com', '$2a$10$PLPKvQhziSVtwHAWlUOXBOzkmFKXxzFEQAnLlwCvkyBKS1piPP9Se', 'manual', 'club', NULL, '2025-09-13 23:42:14'),
(6, 'tafipadel', 'tafipadel@gmail.com', '$2a$10$xmYZAdBgeV4V.IwRrz0C8OeM1djfGkdQxIAoWd6D05IVJWuGdJAp6', 'manual', 'club', NULL, '2025-09-13 23:42:48');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `canchas`
--
ALTER TABLE `canchas`
  ADD PRIMARY KEY (`id_cancha`),
  ADD KEY `id_club` (`id_club`);

--
-- Indices de la tabla `club`
--
ALTER TABLE `club`
  ADD PRIMARY KEY (`id_club`),
  ADD UNIQUE KEY `nroClub` (`nroClub`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD UNIQUE KEY `usuario` (`usuario`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `usuario` (`usuario`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD KEY `id_club` (`id_club`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `canchas`
--
ALTER TABLE `canchas`
  MODIFY `id_cancha` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT de la tabla `club`
--
ALTER TABLE `club`
  MODIFY `id_club` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `canchas`
--
ALTER TABLE `canchas`
  ADD CONSTRAINT `canchas_ibfk_1` FOREIGN KEY (`id_club`) REFERENCES `club` (`id_club`) ON DELETE CASCADE;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_club`) REFERENCES `club` (`id_club`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
