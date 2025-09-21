const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Salarie = sequelize.define('Salarie', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  matricule: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  nom: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  taux_horaire: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  acamion: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'salaries',
  timestamps: true,
});

module.exports = Salarie;
