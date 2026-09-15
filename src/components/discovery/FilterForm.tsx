import { Button } from "@/components/ui/Button";
import { PRICE_RANGES } from "@/types/collection";
import type { CollectionQuery, HiddenFilterKey } from "@/types/collection";
import type { CatalogueFilters } from "@/types/catalogue";
import { genderLabel, shapeLabel } from "@/lib/collection-query";
import styles from "./FilterForm.module.css";

type FilterFormProps = {
  id?: string;
  value: CollectionQuery;
  options: CatalogueFilters;
  hidden: HiddenFilterKey[];
  onChange: (next: CollectionQuery) => void;
};

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function FilterForm({
  id,
  value,
  options,
  hidden,
  onChange,
}: FilterFormProps) {
  return (
    <div className={styles.form} id={id}>
      {hidden.includes("gender") ? null : (
        <fieldset className={styles.group}>
          <legend className="text-micro">Gender</legend>
          {options.genders.map((gender) => (
            <label key={gender} className={styles.option}>
              <input
                type="checkbox"
                name="gender"
                value={gender}
                checked={value.genders.includes(gender)}
                onChange={() =>
                  onChange({
                    ...value,
                    genders: toggleValue(value.genders, gender),
                  })
                }
              />
              <span className="text-small">{genderLabel(gender)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {hidden.includes("brand") ? null : (
        <fieldset className={styles.group}>
          <legend className="text-micro">Brand</legend>
          {options.brands.map((brand) => (
            <label key={brand.id} className={styles.option}>
              <input
                type="checkbox"
                name="brand"
                value={brand.slug}
                checked={value.brands.includes(brand.slug)}
                onChange={() =>
                  onChange({
                    ...value,
                    brands: toggleValue(value.brands, brand.slug),
                  })
                }
              />
              <span className="text-small">{brand.name}</span>
            </label>
          ))}
        </fieldset>
      )}

      {hidden.includes("shape") ? null : (
        <fieldset className={styles.group}>
          <legend className="text-micro">Shape</legend>
          {options.shapes.map((shape) => (
            <label key={shape} className={styles.option}>
              <input
                type="checkbox"
                name="shape"
                value={shape}
                checked={value.shapes.includes(shape)}
                onChange={() =>
                  onChange({
                    ...value,
                    shapes: toggleValue(value.shapes, shape),
                  })
                }
              />
              <span className="text-small">{shapeLabel(shape)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className={styles.group}>
        <legend className="text-micro">Colour</legend>
        {options.colours.map((colour) => (
          <label key={colour.id} className={styles.option}>
            <input
              type="checkbox"
              name="colour"
              value={colour.slug}
              checked={value.colours.includes(colour.slug)}
              onChange={() =>
                onChange({
                  ...value,
                  colours: toggleValue(value.colours, colour.slug),
                })
              }
            />
            <span className="text-small">{colour.name}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="text-micro">Price</legend>
        <label className={styles.option}>
          <input
            type="radio"
            name="price"
            value=""
            checked={!value.price}
            onChange={() => onChange({ ...value, price: undefined })}
          />
          <span className="text-small">Any</span>
        </label>
        {PRICE_RANGES.map((range) => (
          <label key={range.id} className={styles.option}>
            <input
              type="radio"
              name="price"
              value={range.id}
              checked={value.price === range.id}
              onChange={() => onChange({ ...value, price: range.id })}
            />
            <span className="text-small">{range.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="text-micro">Availability</legend>
        <label className={styles.option}>
          <input
            type="checkbox"
            name="availability"
            value="in_stock"
            checked={value.inStockOnly}
            onChange={() =>
              onChange({ ...value, inStockOnly: !value.inStockOnly })
            }
          />
          <span className="text-small">In stock</span>
        </label>
      </fieldset>
    </div>
  );
}

type FilterFormActionsProps = {
  onClear: () => void;
  onApply: () => void;
};

export function FilterFormActions({ onClear, onApply }: FilterFormActionsProps) {
  return (
    <div className={styles.actions}>
      <Button variant="tertiary" onClick={onClear}>
        Clear all
      </Button>
      <Button onClick={onApply}>Apply</Button>
    </div>
  );
}
