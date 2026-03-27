import app from './src/app.js';
import { initializeDatabase } from './src/config/database.js';

const PORT = process.env.PORT || 3001;

// Inicializa la base de datos (tablas y datos mock) antes de iniciar el servidor
try {
  initializeDatabase();
  console.log('✅ Base de datos inicializada correctamente');
} catch (error) {
  console.error('❌ Error inicializando base de datos:', error);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 Fixio Backend corriendo en http://localhost:${PORT}`);
});
