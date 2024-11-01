import calcularFechaFin from "../helpers/calcularFecha.js";
import { eliminarArchivoAnterior } from "../middleware/archivosubidor.js";
import Contrato from "../models/Contratos.js";
import path from "path";
import Factura from "../models/Factura.js";
import getDirectLink from "../helpers/generarLink.js";
import dbx from "../config/dbx.js";
import fs from "fs";
import limpiarCarpetaLocal from "../helpers/limpiarCarpeta.js";
import { type } from "os";
import Notification from "../models/Notification.js";
import Direccion from "../models/Direccion.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const registrarContrato = async (req, res) => {
  const { usuario } = req;

  // Extraer datos del cuerpo de la solicitud
  const {
    numeroDictamen,
    tipoDeContrato,
    objetoDelContrato,
    entidad,
    direccionEjecuta,
    fechaRecibido,
    valor,
    vigencia,
    estado,
    aprobadoPorCC,
    firmado,
    entregadoJuridica,
  } = req.body;
  // Crear un nuevo contrato

  try {
    const contrato = await Contrato.findOne({
      $and: [
        { numeroDictamen: numeroDictamen },
        { direccionEjecuta: direccionEjecuta },
      ],
    });

    console.log(contrato);

    if (contrato && contrato._id) {
      return res.status(403).json({
        msg: `El registro del contrato ${numeroDictamen} ya existe en la ${direccionEjecuta}`,
      });
    }
    if (usuario.tipo_usuario === "especialista") {
      console.log("aqui");
      const direcciones = await Direccion.find({ ejecutivoId: relacionId });
      if (direcciones.length === 0) {
        return res
          .status(403)
          .json({ msg: `No tienes permiso a para realizar esta accion` });
      }
      const tienePermisos = direcciones.some(
        (dir) => dir.direccionEjecutiva === direccionEjecuta
      );

      if (!tienePermisos) {
        return res.status(403).json({
          msg: `No tienes permiso para crear un nuevo contrato de esta dirección`,
        });
      }
    }
    if (usuario.tipo_usuario === "director") {
      const direcciones = await Direccion.find({ ejecutivoId: usuario._id });
      if (direcciones.length === 0) {
        return res
          .status(403)
          .json({ msg: `No tienes permiso a para realizar esta accion` });
      }

      const tienePermisos = direcciones.some(
        (dir) => dir.direccionEjecutiva === direccionEjecuta
      );

      if (!tienePermisos) {
        return res.status(403).json({
          msg: `No tienes permiso para crear un nuevo contrato de esta dirección`,
        });
      }
    }
    let newContrato;
    if (req.file) {
      const extension = path.extname(req.file.filename).toLowerCase();
      // Verificar si la extensión coincide con lo permitido
      const allowedExtensions = [".pdf"];
      if (!allowedExtensions.includes(extension)) {
        const ruta = `./public/documents/contracts/${req.file.filename}`;
        eliminarArchivoAnterior(ruta);
        return res.status(400).json({ msg: "Solo se permiten archivos PDF" });
      }
      const originalName = req.file.originalname;
      // Subir archivo a Dropbox
      const filePath = req.file.path;
      const uploadedFile = await dbx.filesUpload({
        path: "/documentos/" + req.file.filename,
        contents: fs.readFileSync(filePath),
        mode: "add",
        autorename: true,
        mute: true,
      });

      // Obtener el link público del archivo
      const publicLink = await dbx.sharingCreateSharedLinkWithSettings({
        path: uploadedFile.result.path_display,
        settings: {
          requested_visibility: {
            ".tag": "public",
          },
        },
      });
      if (
        publicLink.error &&
        publicLink.error.summary === "shared_link_already_exists"
      ) {
        return res
          .status(400)
          .json({ msg: "El archivo ya tiene un vínculo compartido público" });
      }
      const link = getDirectLink(publicLink.result.url);

      newContrato = new Contrato({
        tipoDeContrato,
        objetoDelContrato,
        entidad,
        direccionEjecuta,
        fechaRecibido,
        valor,
        valorDisponible: valor,
        vigencia,
        fechaVencimiento: calcularFechaFin(fechaRecibido, vigencia),
        estado,
        aprobadoPorCC,
        firmado,
        entregadoJuridica,
        numeroDictamen,
        subirPDF: link,
        originalName,
        dropboxPath: uploadedFile.result.path_display,
        info: {
          creadoPor: usuario.nombre,
          fechaDeCreacion: new Date().toISOString(),
          modificadoPor: usuario.nombre,
          fechaDeModificacion: new Date().toISOString(),
        },
      });
    } else {
      newContrato = new Contrato({
        tipoDeContrato,
        objetoDelContrato,
        entidad,
        direccionEjecuta,
        fechaRecibido,
        valor,
        valorDisponible: valor,
        vigencia,
        fechaVencimiento: calcularFechaFin(fechaRecibido, vigencia),
        estado,
        aprobadoPorCC,
        firmado,
        entregadoJuridica,
        numeroDictamen,
        info: {
          creadoPor: usuario.nombre,
          fechaDeCreacion: new Date().toISOString(),
          modificadoPor: usuario.nombre,
          fechaDeModificacion: new Date().toISOString(),
        },
      });
    }
    // Guardar el contrato en la base de datos
    await newContrato.save();
    const rutaCarpeta = path.join(
      __dirname,
      "..",
      "public",
      "documents",
      "contracts"
    );
    limpiarCarpetaLocal(rutaCarpeta)
      .then(() => console.log("Proceso de limpieza completado"))
      .catch((error) => console.error("Error en el proceso:", error));
    return res.status(200).json({ msg: "Contrato registrado exitosamente" });
  } catch (error) {
    console.error("Error al registrar contrato:", error);
    return res.status(500).json({ error: "Error al registrar contrato" });
  }
};

const obtenerRegistroContratos = async (req, res) => {
  const { usuario } = req;
  try {
    if (usuario.tipo_usuario === "director") {
      const direcciones = await Direccion.find({ ejecutivoId: usuario._id });

      const contratos = await Contrato.find({
        direccionEjecuta: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
      });
      return res.status(200).json(contratos);
    }
    if (usuario.tipo_usuario === "especialista") {
      const direcciones = await Direccion.find({
        ejecutivoId: usuario.relacionId,
      });
      const contratos = await Contrato.find({
        direccionEjecuta: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
      });

      return res.status(200).json(contratos);
    }
    const allcontract = await Contrato.find();
    return res.status(200).json(allcontract);
  } catch (error) {
    console.error("Error al obtener registros de contratos:", error);
    return res
      .status(500)
      .json({ msg: "Ocurrio un error al listar los  contratos" });
  }
};
const actualizarRegistroContrato = async (req, res) => {
  const { id } = req.params;
  const { usuario } = req;
  const bodyRest = { ...req.body };
  delete bodyRest.subirPDF;

  if (req.body.subirPDF) {
    const extension = path.extname(req.file.filename).toLowerCase();
    // Verificar si la extensión coincide con lo permitido
    const allowedExtensions = [".pdf"];
    if (!allowedExtensions.includes(extension)) {
      const ruta = `./public/documents/contracts/${req.file.filename}`;
      eliminarArchivoAnterior(ruta);
      return res.status(400).json({ msg: "Solo se permiten archivos PDF" });
    }
  }
  try {
    const contrato = await Contrato.findById(id);
    if (!contrato) {
      return res.status(404).json({ msg: "Contrato no encontrado" });
    }
    if (req.body.valor) {
      if (req.body.valor < contrato.valorGastado) {
        return res.status(400).json({
          msg: "El valor del contrato no puede ser menor que el valor  gastado",
        });
      }
    }
    if (req.body.fechaRecibido) {
      // Otra forma de obtener la fecha actual
      const fechaparce = new Date().toISOString();

      if (req.body.fechaRecibido > fechaparce) {
        return res.status(400).json({
          msg: "La fecha de recepción no puede ser  mayor a la fecha actual",
        });
      }
    }

    if (!req.file) {
      await contrato.updateOne(
        {
          $set: bodyRest,
          "info.modificadoPor": usuario.nombre,
          "info.fechaDeModificacion": new Date().toISOString(),
        },
        {
          new: true,
        }
      );
      if (req.body.valor) {
        contrato.valorDisponible = req.body.valor - contrato.valorGastado;
      }
      if (req.body.fechaRecibido) {
        contrato.fechaVencimiento = calcularFechaFin(
          contrato.fechaRecibido,
          contrato.vigencia
        );
      }
      await contrato.save();
      return res
        .status(200)
        .json({ msg: "Contrato actualizado exitosamente", contrato });
    }

    await dbx.filesDeleteV2({
      path: contrato.dropboxPath,
    });

    console.log(
      "Archivo existente eliminado de la nube:",
      contrato.originalName
    );
    // Subir archivo a Dropbox
    const filePath = req.file.path;
    const uploadedFile = await dbx.filesUpload({
      path: "/documentos/" + req.file.filename,
      contents: fs.readFileSync(filePath),
      mode: "add",
      autorename: true,
      mute: true,
    });

    // Obtener el link público del archivo
    const publicLink = await dbx.sharingCreateSharedLinkWithSettings({
      path: uploadedFile.result.path_display,
      settings: {
        requested_visibility: {
          ".tag": "public",
        },
      },
    });
    const link = getDirectLink(publicLink.result.url);

    await contrato.updateOne(
      {
        $set: bodyRest,
        "info.1.modificadoPor": usuario.nombre,
        "info.1.fechaDeModificacion": new Date().toISOString(),
      },
      { $unset: { subirPDF: link } },
      { new: true }
    );

    if (req.body.valor) {
      contrato.valorDisponible = req.body.valor - contrato.valorGastado;
    }
    if (req.body.fechaRecibido) {
      contrato.fechaVencimiento = calcularFechaFin(
        contrato.fechaRecibido,
        contrato.vigencia
      );
    }
    await contrato.save();
    const rutaCarpeta = path.join(
      __dirname,
      "..",
      "public",
      "documents",
      "contracts"
    );
    limpiarCarpetaLocal(rutaCarpeta)
      .then(() => console.log("Proceso de limpieza completado"))
      .catch((error) => console.error("Error en el proceso:", error));
    return res
      .status(200)
      .json({ msg: "Contrato actualizado exitosamente", contrato });
  } catch (error) {
    console.error("Ha ocurrido un error al actualizar:", error);
    return res
      .status(500)
      .json({ msg: "Error al intentar actualizar el registro" });
  }
};

const eliminarRegistroContrato = async (req, res) => {
  const { id } = req.params;
  try {
    const contrato = await Contrato.findById(id);
    if (!contrato) {
      return res.status(404).json({ msg: "Contrato no encontrado" });
    }
    const facturas = await Factura.find({ contratoId: id });
    if (facturas.length > 0) {
      await Factura.deleteMany({ contratoId: id });
    }
    if (contrato.dropboxPath) {
      await dbx.filesDeleteV2({
        path: contrato.dropboxPath,
      });
    }
    await contrato.deleteOne();
    return res.status(200).json({ msg: "Contrato eliminado exitosamente" });
  } catch (error) {
    console.error("Ha ocurrido un error al eliminar:", error);
    return res
      .status(500)
      .json({ msg: "Error al intentar eliminar el registro" });
  }
};

const obtenerContratosFiltrados = async (req, res) => {
  const { estado, direccionEjecuta, entidad } = req.body;
  const { usuario } = req;

  try {
    let query = {};

    if (estado) {
      query.estado = estado;
    }

    if (direccionEjecuta) {
      query.direccionEjecuta = direccionEjecuta;
    }

    if (entidad) {
      query.entidad = entidad;
    }
    if (usuario.tipo_usuario === "director") {
      const direcciones = await Direccion.find({ ejecutivoId: usuario._id });
      const contratos = await Contrato.find({
        direccionEjecuta: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
        ...query, // Asegúrate de que 'query' esté definido antes de esta línea
      });

      // Filtra los contratos según la query si es necesario
      const filteredContratos = contratos.filter((item) =>
        Object.keys(query).every((key) => item[key] === query[key])
      );

      return res.status(200).json(filteredContratos);
    }
    if (usuario.tipo_usuario === "especialista") {
      const direcciones = await Direccion.find({
        ejecutivoId: usuario.relacionId,
      });
      const contratos = await Contrato.find({
        direccionEjecuta: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
        ...query, // Asegúrate de que 'query' esté definido antes de esta línea
      });

      // Filtra los contratos según la query si es necesario
      const filteredContratos = contratos.filter((item) =>
        Object.keys(query).every((key) => item[key] === query[key])
      );

      return res.status(200).json(filteredContratos);
    }

    const contratos = await Contrato.find(query);
    return res.status(200).json(contratos);
  } catch (error) {
    console.error("Ha ocurrido un error al obtener los contratos:", error);
    return res
      .status(500)
      .json({ msg: "Error al intentar obtener los contratos" });
  }
};

const notificarcontratos = async (req, res) => {
  const { usuario } = req;
  try {
    let contratos;
    let notificaciones;
    const hoy = new Date();
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(hoy.getDate() + 30); // Fecha límite para los contratos que están por vencer

    // Función para crear una notificación si no existe
    const createNotificationIfNotExists = async (contratoId) => {
      const existingNotification = await Notification.findOne({
        contratoId: contratoId,
      });

      if (!existingNotification) {
        const contrato = await Contrato.findById(contratoId);
        if (!contrato) {
          console.log(`Contrato con ID ${contratoId} no encontrado`);
          return;
        }

        const notification = new Notification({
          description: `El contrato ${contrato.numeroDictamen} está por vencer.`,
          direccionEjecutiva: contrato.direccionEjecuta,
          contratoId: contrato._id,
          fechaVencimiento: contrato.fechaVencimiento,
          entidad: contrato.entidad,
        });
        await notification.save();
        console.log(
          `Notificación creada para el contrato ${contrato.numeroDictamen}`
        );
      } else {
      }
    };

    // Acceso completo a todos los contratos que están por vencer
    contratos = await Contrato.find({
      fechaVencimiento: { $gte: hoy, $lte: fechaLimite }, // Contratos que van a vencer en 30 días
    });

    if (!contratos || contratos.length === 0) {
      res
        .status(200)
        .json({ msg: "No hay contratos por vencer en los próximos 30 días." });
      console.log("No hay contratos por vencer");
    } else {
      // Crear notificaciones para cada contrato si no existe una
      await Promise.all(
        [...new Set(contratos.map((c) => c._id))].map(async (id) => {
          await createNotificationIfNotExists(id);
        })
      );

      if (usuario.tipo_usuario === "director") {
        const direcciones = await Direccion.find({ ejecutivoId: usuario._id });

        const notificacionesServicios = await Notification.find({
          direccionEjecutiva: {
            $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
          },
          readByDirector: false,
        });

        return res.status(200).json(notificacionesServicios);
      }

      if (usuario.tipo_usuario === "especialista") {
        const direcciones = await Direccion.find({
          ejecutivoId: usuario.relacionId,
        });

        const notificacionesServicios = await Notification.find({
          direccionEjecutiva: {
            $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
          },
          readByEspecialista: false,
        });

        return res.status(200).json(notificacionesServicios);
      }
      const allNotification = await Notification.find({
        readByAdmin: false,
      });
      return res.status(200).json(allNotification);
    }
  } catch (error) {
    console.error("Ha ocurrido un error al obtener los contratos:", error);
    return res
      .status(500)
      .json({ msg: "Error al intentar obtener los contratos" });
  }
};
const marcarComoLeidas = async (req, res) => {
  const { usuario } = req;
  const { id } = req.params;

  try {
    const notificacion = await Notification.findById(id);

    if (notificacion) {
      if (usuario.tipo_usuario === "director") {
        notificacion.readByDirector = true;
      }
      if (usuario.tipo_usuario === "especialista") {
        notificacion.readByEspecialista = true;
      }
      notificacion.readByAdmin = true;
      // Actualizar la notificación en la base de datos
      const updatedNotification = await notificacion.save();
      return res.status(200).json({
        msg: "Notificación eliminada correctamente",
        updatedNotification,
      });
    } else {
      return res.status(404).json({ msg: "Notificación no encontrada" });
    }
  } catch (error) {
    console.error("Ha ocurrido un error:", error);
    return res
      .status(500)
      .json({ msg: "Error al intentar marcar la notificación como leída" });
  }
};

const marcarleidasAll = async (req, res) => {
  const { usuario } = req;
  try {
    if (usuario.tipo_usuario === "director") {
      const direcciones = await Direccion.find({ ejecutivoId: usuario._id });
      const notificaciones = await Notification.find({
        readBySer: false,
        direccionEjecutiva: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
      });
      await Promise.all(
        notificaciones.map(async (notificacion) => {
          notificacion.readByDirector = true;
          return notificacion;
        })
      );
      await Notification.bulkWrite(
        notificaciones.map((n) => ({
          updateOne: {
            filter: { _id: n._id },
            update: { $set: { readByDirector: true } },
          },
        }))
      );
      return res.status(200).json({
        msg: "Se han limpiado todas las notificaciones correctamente",
      });
    }
    if (usuario.tipo_usuario === "especialista") {
      const direcciones = await Direccion.find({
        ejecutivoId: usuario.relacionId,
      });
      const notificaciones = await Notification.find({
        readByEspecialista: false,
        direccionEjecutiva: {
          $in: direcciones.map((direccion) => direccion.direccionEjecutiva),
        },
      });
      await Notification.bulkWrite(
        notificaciones.map((n) => ({
          updateOne: {
            filter: { _id: n._id },
            update: { $set: { readByEspecialista: true } },
          },
        }))
      );
      return res.status(200).json({
        msg: "Se han limpiado todas las notificaciones correctamente",
      });
    }

    const notificaciones = await Notification.find({ readByAdmin: false });
    await Promise.all(
      notificaciones.map(async (notificacion) => {
        notificacion.readByAdmin = true;
        return notificacion;
      })
    );
    await Notification.bulkWrite(
      notificaciones.map((n) => ({
        updateOne: {
          filter: { _id: n._id },
          update: { $set: { readByAdmin: true } },
        },
      }))
    );
    return res.status(200).json({
      msg: "Se han limpiado todas las notificaciones correctamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      msg: "Error al intentar marcar la notificación como leída",
      error,
    });
  }
};

const eliminarNotificacionesArchivadas = async (req, res) => {
  try {
    const notificacionesleidas = await Notification.find({
      readByAdmin: true,
      readBySer: true,
      readByMant: true,
    });
    if (!notificacionesleidas) {
      return res.status(200).json();
    }
    await Notification.deleteMany({
      readByAdmin: true,
      readBySer: true,
      readByMant: true,
    });
    console.log("Notificaciones eliminadas");
    return res.status(200).json();
  } catch (error) {
    console.error(
      "Ha ocurrido un error al eliminar las notificaciones leidas:",
      error
    );
    return res
      .status(500)
      .json({ msg: "Error al intentar eliminar las notificaciones leidas" });
  }
};

const cambiarEstado = async (req, res) => {
  try {
    // Obtener la fecha actual
    const currentDate = new Date();

    // Buscar todos los contratos activos que vencieron
    const contratosVencidos = await Contrato.find({
      estado: "Ejecucion",
      fechaVencimiento: { $lte: currentDate },
    });
    if (!contratosVencidos) {
      return res.status(200).json();
    }

    // Actualizar el estado de los contratos vencidos
    const result = await Contrato.updateMany(
      { estado: "Ejecucion", fechaVencimiento: { $lte: currentDate } },
      { $set: { estado: "Finalizado" } }
    );

    // Respuesta exitosa
    res.status(200).json({ msg: "Estados de contratos actualizados" });
  } catch (error) {
    console.error("Error al actualizar estados de contratos:", error);
    res
      .status(500)
      .json({ msg: "Ocurrió un error al actualizar los estados de contratos" });
  }
};
export {
  registrarContrato,
  obtenerRegistroContratos,
  actualizarRegistroContrato,
  eliminarRegistroContrato,
  obtenerContratosFiltrados,
  notificarcontratos,
  marcarComoLeidas,
  eliminarNotificacionesArchivadas,
  marcarleidasAll,
  cambiarEstado,
};