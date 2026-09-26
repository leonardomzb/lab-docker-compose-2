CREATE TABLE IF NOT EXISTS cuadros (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    autor VARCHAR(100),
    anio INT
);

INSERT INTO cuadros (id, nombre, autor, anio) VALUES 
(1, 'Mona Lisa', 'Leonardo da Vinci', 1503),
(2, 'La Noche Estrellada', 'Vincent van Gogh', 1889),
(3, 'El grito', 'Edvard Munch', 1893)
ON CONFLICT DO NOTHING;