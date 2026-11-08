import { CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RightOutlined, StarFilled } from "@ant-design/icons";
import { Button, Input, Modal, Popconfirm, Skeleton, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage } from "../../habitfer/format";
import { deleteSavedMeal, fetchFavorites, fetchRecipes, fetchSavedMeals, setFavorite, updateSavedMeal } from "../api";
import { defaultAmount, lastAmount, thingsText } from "../format";
import { gramsText, kcalText, quantityText } from "../math";
import type { FavoriteFood, RecipeSummary, SavedMealView } from "../types";

/** Cocina: tus recetas, tus comidas guardadas y tus favoritos, para crearlos y ordenarlos. */
export function NutriKitchenPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [saved, setSaved] = useState<SavedMealView[] | null>(null);
  const [favorites, setFavorites] = useState<FavoriteFood[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<SavedMealView | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchRecipes()
      .then(setRecipes)
      .catch((err) => message.error(apiErrorMessage(err, "No se pudieron cargar las recetas")));
    fetchSavedMeals()
      .then(setSaved)
      .catch((err) => message.error(apiErrorMessage(err, "No se pudieron cargar las comidas guardadas")));
    fetchFavorites()
      .then(setFavorites)
      .catch((err) => message.error(apiErrorMessage(err, "No se pudieron cargar los favoritos")));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceSaved = (m: SavedMealView) => setSaved((list) => list?.map((x) => (x.id === m.id ? m : x)) ?? list);

  const removeItem = async (m: SavedMealView, itemId: string) => {
    try {
      replaceSaved(await updateSavedMeal(m.id, { itemIds: m.items.filter((i) => i.id !== itemId).map((i) => i.id) }));
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo quitar"));
    }
  };

  const removeSaved = async (m: SavedMealView) => {
    try {
      await deleteSavedMeal(m.id);
      setSaved((list) => list?.filter((x) => x.id !== m.id) ?? list);
      message.success(`«${m.name}» se borró`);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo borrar"));
    }
  };

  const rename = async () => {
    if (!renaming || !newName.trim()) return;
    setBusy(true);
    try {
      replaceSaved(await updateSavedMeal(renaming.id, { name: newName.trim() }));
      setRenaming(null);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo cambiar el nombre"));
    } finally {
      setBusy(false);
    }
  };

  const unstar = async (f: FavoriteFood) => {
    setFavorites((list) => list?.filter((x) => x.id !== f.id) ?? list);
    try {
      await setFavorite(f.id, false);
    } catch (err) {
      message.error(apiErrorMessage(err, "No se pudo quitar"));
      load();
    }
  };

  return (
    <div className="nf-kitchen">
      <div className="nf-kitchen__intro">
        <h1 className="nf-page-title">Cocina</h1>
        <p className="nf-page-lead">Tus recetas, tus comidas guardadas y tus favoritos: lo que anotas de un toque.</p>
      </div>

      <section className="nf-card nf-kitchen__recipes" aria-labelledby="nf-k-recipes">
        <div className="nf-card__head">
          <h2 id="nf-k-recipes">Recetas</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/app/nutrifer/cocina/receta/nueva")}>
            Nueva receta
          </Button>
        </div>
        {recipes === null ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : recipes.length === 0 ? (
          <p className="nf-explain">
            Anota una vez los ingredientes del ajiaco o los fríjoles de la casa y cuántas porciones salen: te calculo las calorías de cada porción y la
            encuentras al buscar.
          </p>
        ) : (
          <div className="nf-list nf-list--tiles">
            {recipes.map((r) => (
              <button key={r.id} type="button" className="nf-list__row" onClick={() => navigate(`/app/nutrifer/cocina/receta/${r.id}`)}>
                <span className="nf-list__main">
                  <b>{r.name}</b>
                  <small>
                    {quantityText(r.servings)} {r.servings === 1 ? "porción" : "porciones"} de {kcalText(r.servingGrams)} g · {r.ingredients}{" "}
                    {r.ingredients === 1 ? "ingrediente" : "ingredientes"}
                  </small>
                </span>
                <span className="nf-list__side">
                  <b>{kcalText(r.kcalServing)}</b>
                  <small>kcal por porción</small>
                </span>
                <RightOutlined className="nf-list__chev" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="nf-card" aria-labelledby="nf-k-saved">
        <h2 id="nf-k-saved">Comidas guardadas</h2>
        {saved === null ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : saved.length === 0 ? (
          <p className="nf-explain">
            En <b>Hoy</b>, toca el menú <b>⋯</b> de una comida y elige <b>Guardar como comida</b>. Luego la anotas completa desde «Agregar», con un toque.
          </p>
        ) : (
          <div className="nf-list">
            {saved.map((m) => {
              const expanded = open === m.id;
              return (
                <div key={m.id} className={`nf-list__group${expanded ? " is-open" : ""}`}>
                  <button type="button" className="nf-list__row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : m.id)}>
                    <span className="nf-list__main">
                      <b>{m.name}</b>
                      <small>
                        {thingsText(m.items.length)} · {gramsText(m.protein)} g de proteína
                      </small>
                    </span>
                    <span className="nf-list__side">
                      <b>{kcalText(m.kcal)}</b>
                      <small>kcal</small>
                    </span>
                    <RightOutlined className="nf-list__chev" />
                  </button>
                  {expanded && (
                    <div className="nf-list__items">
                      {m.items.map((i) => (
                        <div key={i.id} className="nf-list__item">
                          <span>
                            {i.name}
                            <small>{i.amount || "Registro rápido"}</small>
                          </span>
                          <span className="nf-list__kcal">{kcalText(i.kcal)}</span>
                          {m.items.length > 1 && (
                            <button type="button" className="nf-icon-btn nf-icon-btn--sm" aria-label={`Quitar ${i.name}`} onClick={() => void removeItem(m, i.id)}>
                              <CloseOutlined />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="nf-list__tools">
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => {
                            setRenaming(m);
                            setNewName(m.name);
                          }}
                        >
                          Cambiar nombre
                        </Button>
                        <Popconfirm title={`¿Borrar «${m.name}»?`} description="Lo que ya anotaste con ella se queda." okText="Borrar" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => void removeSaved(m)}>
                          <Button danger type="text" icon={<DeleteOutlined />}>
                            Borrar
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="nf-card" aria-labelledby="nf-k-favs">
        <h2 id="nf-k-favs">Favoritos</h2>
        {favorites === null ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : favorites.length === 0 ? (
          <p className="nf-explain">
            Al abrir un alimento, toca la estrella <StarFilled style={{ color: "var(--nf-maiz)" }} /> y sale arriba cada vez que agregas algo.
          </p>
        ) : (
          <div className="nf-list">
            {favorites.map((f) => {
              const amount = f.last ? lastAmount(f.last) : defaultAmount(f);
              return (
                <div key={f.id} className="nf-list__row nf-list__row--static">
                  <span className="nf-list__main">
                    <b>{f.name}</b>
                    <small>{amount.text}</small>
                  </span>
                  <span className="nf-list__side">
                    <b>{kcalText(amount.kcal)}</b>
                    <small>kcal</small>
                  </span>
                  <button type="button" className="nf-star is-on" aria-label={`Quitar ${f.name} de favoritos`} onClick={() => void unstar(f)}>
                    <StarFilled />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={renaming !== null}
        title="Cambiar nombre"
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={busy}
        okButtonProps={{ disabled: !newName.trim() }}
        onOk={() => void rename()}
        onCancel={() => setRenaming(null)}
        rootClassName="nf-drawer"
        centered
      >
        <Input size="large" maxLength={80} value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} onPressEnter={() => void rename()} aria-label="Nombre de la comida guardada" />
      </Modal>
    </div>
  );
}
