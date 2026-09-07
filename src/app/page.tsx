import Image from "next/image";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Grid, GridItem } from "@/components/layout/Grid";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { ProductGrid } from "@/components/product/ProductGrid";
import {
  assertDemoCatalogueIntegrity,
  getProducts,
} from "@/services/catalogue";
import styles from "./page.module.css";

const colours = [
  { name: "Deep Navy", value: "#0B1C2D", className: styles["swatch__chip--navy"] },
  {
    name: "Warm Off-White",
    value: "#F7F6F2",
    className: styles["swatch__chip--off-white"],
  },
  { name: "Soft Stone", value: "#E9E7E1", className: styles["swatch__chip--stone"] },
  {
    name: "Near Black",
    value: "#111111",
    className: styles["swatch__chip--near-black"],
  },
  { name: "White", value: "#FFFFFF", className: styles["swatch__chip--white"] },
] as const;

const spaces = [4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 120] as const;

export default function FoundationPreviewPage() {
  assertDemoCatalogueIntegrity();

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth className={styles.intro}>
          <div className={styles.stack}>
            <Image
              src="/brand/shadesuk-wordmark.jpg"
              alt="SHADESUK"
              width={1099}
              height={253}
              className={styles.wordmark}
              priority
            />
            <h1 className="text-display">Foundation preview</h1>
            <p className={`text-body ${styles.note}`}>
              Development surface for locked tokens, type, layout, and
              interaction foundations. This is not the storefront homepage.
            </p>
          </div>
        </ContentWidth>

        <ContentWidth>
          <Section labelledBy="type-heading" compact>
            <div className={styles.stack}>
              <h2 id="type-heading" className="text-h2">
                Typography
              </h2>
              <p className="text-display">Shades for every angle.</p>
              <p className="text-h1">Find your frame.</p>
              <p className="text-h2">The shades people are wearing</p>
              <p className="text-h3">Size and face guide</p>
              <p className="text-body">
                SHADESUK should feel like a modern eyewear label first and an
                ecommerce website second. Quiet, confident, and product-led.
              </p>
              <p className="text-small">Secure card payment. All major cards accepted.</p>
              <p className="text-micro">New arrivals</p>
            </div>
          </Section>

          <hr className={styles.rule} />

          <Section labelledBy="colour-heading" compact>
            <div className={styles.stack}>
              <h2 id="colour-heading" className="text-h2">
                Colour
              </h2>
              <p className={`text-body ${styles.note}`}>
                Deep Navy is the functional brand colour. Warm Off-White is the
                page background. Near Black is body text. Silver belongs to the
                logo only and is not a UI accent.
              </p>
              <div className={styles["swatch-row"]}>
                {colours.map((colour) => (
                  <figure key={colour.value} className={styles.swatch}>
                    <div className={`${styles.swatch__chip} ${colour.className}`} />
                    <figcaption className={styles["stack--tight"]}>
                      <div className="text-small">{colour.name}</div>
                      <div className="text-micro">{colour.value}</div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </Section>

          <hr className={styles.rule} />

          <Section labelledBy="space-heading" compact>
            <div className={styles.stack}>
              <h2 id="space-heading" className="text-h2">
                Spacing
              </h2>
              <div className={styles["space-row"]}>
                {spaces.map((space) => (
                  <div key={space} className={styles["space-sample"]}>
                    <div
                      className={styles["space-sample__bar"]}
                      style={{ width: space }}
                    />
                    <span className="text-micro">{space}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <hr className={styles.rule} />

          <Section labelledBy="grid-heading" compact>
            <div className={styles.stack}>
              <h2 id="grid-heading" className="text-h2">
                Grid
              </h2>
              <p className={`text-body ${styles.note}`}>
                Page grid is 4 / 8 / 12 columns. Product grid is 2 / 3 / 4
                columns and stays at 4 on large desktop.
              </p>
              <Grid>
                {Array.from({ length: 12 }, (_, index) => (
                  <GridItem key={index}>
                    <div className={`${styles.cell} text-micro`}>
                      {index + 1}
                    </div>
                  </GridItem>
                ))}
              </Grid>
              <Grid variant="product">
                {Array.from({ length: 4 }, (_, index) => (
                  <GridItem key={index}>
                    <div className={`${styles.cell} text-micro`}>Product</div>
                  </GridItem>
                ))}
              </Grid>
            </div>
          </Section>

          <hr className={styles.rule} />

          <Section labelledBy="button-heading" compact>
            <div className={styles.stack}>
              <h2 id="button-heading" className="text-h2">
                Buttons
              </h2>
              <div className={styles.actions}>
                <Button>Add to bag</Button>
                <Button variant="secondary">Continue shopping</Button>
                <Button variant="tertiary">View all</Button>
                <Button disabled>Unavailable</Button>
                <Button loading>Add to bag</Button>
              </div>
            </div>
          </Section>

          <hr className={styles.rule} />

          <Section labelledBy="catalogue-heading" compact>
            <div className={styles.stack}>
              <h2 id="catalogue-heading" className="text-h2">
                Catalogue
              </h2>
              <p className={`text-body ${styles.note}`}>
                Demo fixtures for the reusable product card and grid. This is
                not a collection page. No live inventory or product photography.
              </p>
              <ProductGrid products={getProducts()} />
            </div>
          </Section>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
