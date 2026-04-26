--
-- PostgreSQL database dump
--

\restrict sXovPoPqcHOMkfShfKbvRthUUpSEA4Zb2LIeRTofQsT3xJzTx6BEtbrE4UydrQm

-- Dumped from database version 16.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-04-25 08:29:57

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 16484)
-- Name: products; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    handle text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price_cents integer NOT NULL,
    image_url text NOT NULL,
    in_stock boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_price_cents_check CHECK ((price_cents >= 0))
);


ALTER TABLE public.products OWNER TO shop;

--
-- TOC entry 3461 (class 0 OID 16484)
-- Dependencies: 218
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.products VALUES ('2eb710cd-0c2a-569c-932e-0c1ab47b5bac', 'midnight-roast-1kg-whole', 'Midnight Roast 1 kg whole bean', 'Dark, syrupy, low-acid espresso blend roasted to bring out cocoa and dried-fig notes. Whole bean, 1 kg bag.', 3400, '/products/midnight-roast-1kg-whole.jpg', true, '2026-04-24 05:27:36.125+00');
INSERT INTO public.products VALUES ('b390b676-c8c1-5f58-81b3-17bef94502cf', 'midnight-roast-1kg-ground', 'Midnight Roast 1 kg ground', 'Dark, syrupy, low-acid espresso blend — pre-ground for espresso machines. 1 kg bag.', 3400, '/products/midnight-roast-1kg-ground.jpg', true, '2026-04-24 05:27:36.133+00');
INSERT INTO public.products VALUES ('9a140740-3366-5834-b25c-e59bc45a4505', 'midnight-roast-500g-whole', 'Midnight Roast 500 g whole bean', 'Half-kilo of the Midnight Roast flagship, whole bean.', 1800, '/products/midnight-roast-500g-whole.jpg', true, '2026-04-24 05:27:36.139+00');
INSERT INTO public.products VALUES ('26834f83-ec01-5e7a-976f-66ae1cd69116', 'ethiopian-yirgacheffe-500g', 'Ethiopian Yirgacheffe 500 g', 'Bright, floral single origin. Washed process. Jasmine and bergamot in the cup. Whole bean.', 2200, '/products/ethiopian-yirgacheffe-500g.jpg', true, '2026-04-24 05:27:36.144+00');
INSERT INTO public.products VALUES ('7c4b2800-b818-5dbd-8198-cff5e72bc912', 'v60-pour-over-set', 'V60 Pour-Over Set', 'Ceramic V60 dripper, server, and 100-pack of filters. A complete pour-over starter.', 4500, '/products/v60-pour-over-set.jpg', true, '2026-04-24 05:27:36.186+00');
INSERT INTO public.products VALUES ('97c21adf-23f9-52ac-9446-1f63dd002fa9', 'burr-grinder-manual', 'Manual Burr Grinder', 'Stainless-steel conical burr, adjustable grind size. Hand-cranked, travel-friendly.', 6900, '/products/burr-grinder-manual.jpg', true, '2026-04-24 05:27:36.192+00');
INSERT INTO public.products VALUES ('f9d7fb18-f5aa-578e-8381-bc2d6554380a', 'moka-pot-6cup', 'Moka Pot 6-cup', 'Classic Italian stovetop espresso maker. Aluminium, 6-cup capacity.', 3200, '/products/moka-pot-6cup.jpg', true, '2026-04-24 05:27:36.197+00');
INSERT INTO public.products VALUES ('3fddb2a7-6993-52df-be95-86dc66c854f9', 'double-wall-glass-mug', 'Double-Wall Glass Mug (pair)', 'Two 350 ml double-walled glass mugs. Keeps espresso hot and hands cool.', 2400, '/products/double-wall-glass-mug.jpg', true, '2026-04-24 05:27:36.201+00');
INSERT INTO public.products VALUES ('e052d942-b7ac-557a-8c2f-4a9f702edd24', 'pour-over-kettle-1l', 'Gooseneck Pour-Over Kettle 1 L', 'Stovetop gooseneck kettle with 1-litre capacity. Essential for pour-over precision.', 4800, '/products/pour-over-kettle-1l.jpg', true, '2026-04-24 05:27:36.207+00');
INSERT INTO public.products VALUES ('5acb8659-b460-538d-af6b-34621b530a5e', 'barista-cleaning-tablets', 'Espresso Machine Cleaning Tablets', 'Food-safe descale + backflush tablets. 20-pack. Extends the life of home machines.', 1800, '/products/barista-cleaning-tablets.jpg', true, '2026-04-24 05:27:36.212+00');
INSERT INTO public.products VALUES ('fa7dd972-d4f1-5cdf-a6c9-60000d1aeb04', 'colombia-huila-500g', 'Colombia Huila 500 g', 'Balanced, medium-bodied single origin from the Huila region. Caramel and red-apple notes.', 2000, '/products/colombia-huila-500g.jpg', true, '2026-04-24 05:27:36.15+00');
INSERT INTO public.products VALUES ('6c8f8ace-6a32-5350-87bd-3d18578fbd22', 'guatemala-antigua-500g', 'Guatemala Antigua 500 g', 'Chocolate-forward, full-body classic from the Antigua volcanic soils. Whole bean.', 2100, '/products/guatemala-antigua-500g.jpg', true, '2026-04-24 05:27:36.155+00');
INSERT INTO public.products VALUES ('542ae265-70a3-5b38-88e9-9966c13d8da6', 'kenya-aa-500g', 'Kenya AA 500 g', 'Wine-like, black-currant single origin. Bright and complex. Whole bean.', 2600, '/products/kenya-aa-500g.jpg', true, '2026-04-24 05:27:36.161+00');
INSERT INTO public.products VALUES ('4c5df809-b6b9-5938-965f-720ebcd3ed19', 'house-blend-1kg-whole', 'House Blend 1 kg whole bean', 'Medium roast, everyday drinker. Works for pour-over, French press, and drip. 1 kg.', 2800, '/products/house-blend-1kg-whole.jpg', true, '2026-04-24 05:27:36.166+00');
INSERT INTO public.products VALUES ('4a87d1b3-49b4-554d-b18b-e2abe759cb3d', 'decaf-swiss-water-500g', 'Decaf Swiss Water 500 g', 'Chemical-free decaffeinated. Smooth, nutty, and sweet. Whole bean.', 2400, '/products/decaf-swiss-water-500g.jpg', true, '2026-04-24 05:27:36.171+00');
INSERT INTO public.products VALUES ('b536822d-36eb-5f56-bde5-75cc0ac061f0', 'cold-brew-blend-1kg', 'Cold Brew Blend 1 kg', 'Coarse-friendly blend tuned for 16-hour steeps. Chocolate and molasses. Whole bean.', 3000, '/products/cold-brew-blend-1kg.jpg', true, '2026-04-24 05:27:36.176+00');
INSERT INTO public.products VALUES ('d0d5440c-a1a7-50dc-b396-e1023a5e12a3', 'aeropress-travel-kit', 'AeroPress Travel Kit', 'Classic immersion-plus-pressure brewer with travel cap. Makes a single cup anywhere.', 3900, '/products/aeropress-travel-kit.jpg', true, '2026-04-24 05:27:36.181+00');
INSERT INTO public.products VALUES ('9e536d7e-0da7-59dc-b84f-42527f147c57', 'chocolate-espresso-beans', 'Dark Chocolate Espresso Beans 250 g', 'Whole roasted espresso beans wrapped in dark chocolate. A snack-caffeine hybrid.', 1200, '/products/chocolate-espresso-beans.jpg', true, '2026-04-24 05:27:36.217+00');
INSERT INTO public.products VALUES ('5bf55db6-d2ab-5198-9333-0b26efa840c2', 'coffee-scale-0.1g', 'Coffee Scale (0.1 g precision)', 'Pour-over scale with built-in timer. Precision to 0.1 g up to 3 kg.', 3800, '/products/coffee-scale-0.1g.jpg', true, '2026-04-24 05:27:36.222+00');
INSERT INTO public.products VALUES ('354c7d58-f757-5181-b75f-e3151f95a2c3', 'milk-frothing-pitcher', 'Milk Frothing Pitcher 600 ml', 'Stainless-steel pitcher for silky microfoam. 600 ml is the latte-art sweet spot.', 1600, '/products/milk-frothing-pitcher.jpg', true, '2026-04-24 05:27:36.228+00');


--
-- TOC entry 3317 (class 2606 OID 16493)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 3313 (class 1259 OID 16496)
-- Name: products_description_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX products_description_idx ON public.products USING btree (description);


--
-- TOC entry 3314 (class 1259 OID 16494)
-- Name: products_handle_key; Type: INDEX; Schema: public; Owner: shop
--

CREATE UNIQUE INDEX products_handle_key ON public.products USING btree (handle);


--
-- TOC entry 3315 (class 1259 OID 16495)
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


-- Completed on 2026-04-25 08:29:57

--
-- PostgreSQL database dump complete
--

\unrestrict sXovPoPqcHOMkfShfKbvRthUUpSEA4Zb2LIeRTofQsT3xJzTx6BEtbrE4UydrQm

