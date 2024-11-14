import Contrato from "../models/Contratos.js";
import Entidad from "../models/Entidad.js";

const crearEntidad = async (req, res) => {
  const { usuario } = req;
  const { entidad } = req.body;
  const todasLasEntidades = await Entidad.find();
  if (todasLasEntidades) {
    // Parcializar todas las entidades existentes y la entidad del cuerpo
    const todasLasEntidadesParceadas = todasLasEntidades.map((entidad) =>
      entidad.entidad
        .normalize("NFD")
        .replace(/[\u0300-\u034F]/g, "")
        .toLowerCase()
        .trim()
    );
    const entidadParceadaDelBody = entidad
      .normalize("NFD")
      .replace(/[\u0300-\u034F]/g, "")
      .toLowerCase()
      .trim();

    // Verificar si la entidad del body existe en la lista parcializada de entidades
    if (todasLasEntidadesParceadas.includes(entidadParceadaDelBody)) {
      return res.status(400).json({ msg: "La entidad ya existe" });
    }
  }
  try {
    await Entidad.create({
      entidad: entidad.trim(),
      ejecutivoId: usuario._id,
      nombreEjecutivo: usuario.nombre,
    });

    return res.json({ msg: "Entidad registrada con exito" });
  } catch (error) {
    res.status(500).json({ msg: "Error al crear la entidad" });
  }
};

const obtenerEntidades = async (req, res) => {
  const { usuario } = req;
  try {
    const entidades = await Entidad.find();
    return res.status(200).json(entidades);
  } catch (error) {
    res.status(500).json({ msg: "Error al obtener las entidades" });
  }
};

const modificarEntidad = async (req, res) => {
  try {
    const { entidad } = req.body;
    const entidadactual = await Entidad.findById(req.params.id);
    const entidadExistente = await Entidad.findByIdAndUpdate(
      req.params.id,
      { entidad, modificado: Date.now() },
      { new: true }
    );

    const contratos = await Contrato.find({
      entidad: entidadactual.entidad,
    });
    if (contratos.length > 0) {
      // Modificar cada contrato uno por uno
      const updatedCount = await Promise.all(
        contratos.map(async (contract) => {
          try {
            const result = await Contrato.findByIdAndUpdate(
              contract._id,
              { $set: { entidad } },
              { new: true }
            );
            return result;
          } catch (error) {
            console.error(
              `Error al actualizar contrato ${contract._id}:`,
              error
            );
            return null;
          }
        })
      );

      // Filtrar los resultados para contar solo los que fueron actualizados exitosamente
      const successfulUpdates = updatedCount.filter(Boolean);
      return res.status(200).json({
        msg: `Entidad modificada con exito, se han actualizado ${successfulUpdates.length} contratos`,
      });
    }

    return res.status(200).json({ msg: "Entidad modificada con exito" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Error al modificar la direccion" });
  }
};

const eliminarEntidad = async (req, res) => {
  try {
    // Primero, obtenemos la dirección a eliminar
    const entidadExistente = await Entidad.findById(req.params.id);

    if (!entidadExistente) {
      return res.status(404).json({ msg: "Entidad no encontrada" });
    }

    await entidadExistente.deleteOne();
    return res.status(404).json({ msg: "Entidad eliminada con éxito " });
  } catch (error) {
    return res.status(500).json({ msg: "Error al eliminar la entidad" });
  }
};

export { crearEntidad, obtenerEntidades, modificarEntidad, eliminarEntidad };
