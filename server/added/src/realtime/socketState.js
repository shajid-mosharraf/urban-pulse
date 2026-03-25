let ioInstance = null;

// driverId -> socketId
const onlineDrivers = new Map();
// socketId -> driverId
const socketToDriver = new Map();

const setIo = (io) => {
  ioInstance = io;
};

const getIo = () => ioInstance;

const markDriverOnline = (driverId, socketId) => {
  const normalized = Number(driverId);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return;
  }

  onlineDrivers.set(normalized, socketId);
  socketToDriver.set(socketId, normalized);
};

const markDriverOfflineById = (driverId) => {
  const normalized = Number(driverId);
  const socketId = onlineDrivers.get(normalized);

  if (socketId) {
    socketToDriver.delete(socketId);
  }

  onlineDrivers.delete(normalized);
};

const markDriverOfflineBySocket = (socketId) => {
  const driverId = socketToDriver.get(socketId);
  if (driverId) {
    onlineDrivers.delete(driverId);
    socketToDriver.delete(socketId);
  }
  return driverId || null;
};

const getOnlineDriverIds = () => Array.from(onlineDrivers.keys());
const getOnlineDriverCount = () => onlineDrivers.size;

const emitToOnlineDrivers = (eventName, payload) => {
  if (!ioInstance) {
    return 0;
  }

  for (const socketId of onlineDrivers.values()) {
    ioInstance.to(socketId).emit(eventName, payload);
  }

  return onlineDrivers.size;
};

const emitToDrivers = (driverIds, eventName, payload) => {
  if (!ioInstance || !Array.isArray(driverIds) || driverIds.length === 0) {
    return 0;
  }

  let emittedCount = 0;

  for (const driverIdRaw of driverIds) {
    const driverId = Number(driverIdRaw);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      continue;
    }

    const socketId = onlineDrivers.get(driverId);
    if (!socketId) {
      continue;
    }

    ioInstance.to(socketId).emit(eventName, payload);
    emittedCount += 1;
  }

  return emittedCount;
};

module.exports = {
  setIo,
  getIo,
  markDriverOnline,
  markDriverOfflineById,
  markDriverOfflineBySocket,
  getOnlineDriverIds,
  getOnlineDriverCount,
  emitToOnlineDrivers,
  emitToDrivers,
};
