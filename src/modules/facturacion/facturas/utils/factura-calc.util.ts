type ItemIn = {
  AlicuotaIVA: number;
  Exento?: boolean;
  Consignacion?: boolean;
  Cantidad: number;
  Precio_Unitario_Total?: number;
  Precio_Unitario_Neto?: number;
  IVA_Unitario?: number;
};

type ItemOut = ItemIn & {
  u_neto: number;
  u_iva: number;
  u_total: number;
  t_neto: number;
  t_iva: number;
  t_total: number;
};

const IVA_FACTORES: Record<number, number> = {
  3: 0.0, // 0%
  4: 0.025, // 2.5%
  5: 0.105, // 10.5%
  6: 0.21, // 21%
  8: 0.27, // 27%
};

export function normalizeItem(i: ItemIn): ItemOut {
  const cant = Number(i.Cantidad);
  const alic = i.Exento ? 0 : (IVA_FACTORES[i.AlicuotaIVA] ?? 0);
  let u_neto = 0,
    u_iva = 0,
    u_total = 0;

  if (i.Precio_Unitario_Neto != null) {
    u_neto = i.Precio_Unitario_Neto;
    u_iva =
      i.IVA_Unitario != null ? i.IVA_Unitario : +(u_neto * alic).toFixed(6);
    u_total = +(u_neto + u_iva).toFixed(6);
  } else if (i.Precio_Unitario_Total != null) {
    u_total = i.Precio_Unitario_Total;
    if (alic > 0) {
      u_neto = +(u_total / (1 + alic)).toFixed(6);
      u_iva = +(u_total - u_neto).toFixed(6);
    } else {
      u_neto = u_total;
      u_iva = 0;
    }
  } else {
    throw new Error(
      'Cada item debe tener Precio_Unitario_Neto o Precio_Unitario_Total',
    );
  }

  const t_neto = +(u_neto * cant).toFixed(4);
  const t_iva = +(u_iva * cant).toFixed(4);
  const t_total = +(u_total * cant).toFixed(4);

  return { ...i, u_neto, u_iva, u_total, t_neto, t_iva, t_total };
}

export function resumir(items: ItemOut[]) {
  const total_neto = +items.reduce((a, x) => a + x.t_neto, 0).toFixed(4);
  const total_iva = +items.reduce((a, x) => a + x.t_iva, 0).toFixed(4);
  const total = +items.reduce((a, x) => a + x.t_total, 0).toFixed(4);
  return { total_neto, total_iva, total };
}
