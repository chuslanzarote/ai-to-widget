--
-- PostgreSQL database dump
--

\restrict 52inq0eXZ9uDyHunCDwfWnT8AiOgFCLzragm4aNdWLq4I6UU0tifAT8FvQbe5Db

-- Dumped from database version 16.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-04-25 08:30:56

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

--
-- TOC entry 2 (class 3079 OID 16394)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 3516 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 216 (class 1259 OID 16385)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO shop;

--
-- TOC entry 220 (class 1259 OID 16510)
-- Name: cart_items; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.cart_items (
    id uuid NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.cart_items OWNER TO shop;

--
-- TOC entry 219 (class 1259 OID 16497)
-- Name: carts; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.carts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.carts OWNER TO shop;

--
-- TOC entry 222 (class 1259 OID 16545)
-- Name: order_items; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.order_items (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    unit_price_cents integer NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_cents_check CHECK ((unit_price_cents >= 0))
);


ALTER TABLE public.order_items OWNER TO shop;

--
-- TOC entry 221 (class 1259 OID 16528)
-- Name: orders; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_cents integer NOT NULL,
    status text DEFAULT 'placed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['placed'::text, 'shipped'::text, 'delivered'::text]))),
    CONSTRAINT orders_total_cents_check CHECK ((total_cents >= 0))
);


ALTER TABLE public.orders OWNER TO shop;

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
-- TOC entry 217 (class 1259 OID 16475)
-- Name: users; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO shop;

--
-- TOC entry 3504 (class 0 OID 16385)
-- Dependencies: 216
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public._prisma_migrations VALUES ('c13c8b4e-0da8-4167-8f18-5fbfe6a1150c', 'd238597d8ac41960387b9e5274a10b82a8306d6777539bb9b4bfa9e15ea0a458', '2026-04-24 05:27:31.421995+00', '20260423000000_init', NULL, NULL, '2026-04-24 05:27:31.27076+00', 1);


--
-- TOC entry 3508 (class 0 OID 16510)
-- Dependencies: 220
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.cart_items VALUES ('58cb876b-970c-49cb-8748-a44c4cdc4ce5', '773bd134-cf1c-4cb3-b553-209036e6670c', '2eb710cd-0c2a-569c-932e-0c1ab47b5bac', 2);


--
-- TOC entry 3507 (class 0 OID 16497)
-- Dependencies: 219
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.carts VALUES ('773bd134-cf1c-4cb3-b553-209036e6670c', '76b72246-b789-5632-96d2-07467bfb143d', '2026-04-24 05:30:52.816+00', '2026-04-24 05:30:52.816+00');


--
-- TOC entry 3510 (class 0 OID 16545)
-- Dependencies: 222
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.order_items VALUES ('eee70633-2b00-4911-9220-defc57c9fd17', 'b6cdc7b3-0b6c-4529-a210-350ce8014ea9', 'b536822d-36eb-5f56-bde5-75cc0ac061f0', 'Cold Brew Blend 1 kg', 3000, 1);


--
-- TOC entry 3509 (class 0 OID 16528)
-- Dependencies: 221
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.orders VALUES ('b6cdc7b3-0b6c-4529-a210-350ce8014ea9', '76b72246-b789-5632-96d2-07467bfb143d', 3000, 'placed', '2026-04-24 05:35:51.741+00');


--
-- TOC entry 3506 (class 0 OID 16484)
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
-- TOC entry 3505 (class 0 OID 16475)
-- Dependencies: 217
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: shop
--

INSERT INTO public.users VALUES ('76b72246-b789-5632-96d2-07467bfb143d', 'alice@example.com', '$2a$10$Nw2YOPm3/9v3H14rhwxat.NdILrFFgImLWmiJ5XxzY9/y5OvK3jFe', 'Alice Rivera', '2026-04-24 05:27:35.859+00');
INSERT INTO public.users VALUES ('052d52fb-e599-5b7a-aa21-27b35d36d309', 'bob@example.com', '$2a$10$X9jnk3SBropj3Eyyjw5EVeFMIm5hVPCum9fH3bKBTqvEZ4eEi1ykq', 'Bob Kimathi', '2026-04-24 05:27:35.99+00');
INSERT INTO public.users VALUES ('f2e1db39-5492-53b4-87c1-211642ec46a1', 'carla@example.com', '$2a$10$jcIVwxoXXXpmhjIYDYhx9ecIGx0N63FrP33r35FhZuPsbPVViQR6q', 'Carla Nguyen', '2026-04-24 05:27:36.12+00');


--
-- TOC entry 3334 (class 2606 OID 16393)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3349 (class 2606 OID 16515)
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3344 (class 2606 OID 16503)
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- TOC entry 3354 (class 2606 OID 16553)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3351 (class 2606 OID 16538)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3342 (class 2606 OID 16493)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 3337 (class 2606 OID 16482)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3346 (class 1259 OID 16517)
-- Name: cart_items_cart_id_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX cart_items_cart_id_idx ON public.cart_items USING btree (cart_id);


--
-- TOC entry 3347 (class 1259 OID 16516)
-- Name: cart_items_cart_id_product_id_key; Type: INDEX; Schema: public; Owner: shop
--

CREATE UNIQUE INDEX cart_items_cart_id_product_id_key ON public.cart_items USING btree (cart_id, product_id);


--
-- TOC entry 3345 (class 1259 OID 16504)
-- Name: carts_user_id_key; Type: INDEX; Schema: public; Owner: shop
--

CREATE UNIQUE INDEX carts_user_id_key ON public.carts USING btree (user_id);


--
-- TOC entry 3352 (class 1259 OID 16539)
-- Name: orders_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX orders_user_id_created_at_idx ON public.orders USING btree (user_id, created_at DESC);


--
-- TOC entry 3338 (class 1259 OID 16496)
-- Name: products_description_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX products_description_idx ON public.products USING btree (description);


--
-- TOC entry 3339 (class 1259 OID 16494)
-- Name: products_handle_key; Type: INDEX; Schema: public; Owner: shop
--

CREATE UNIQUE INDEX products_handle_key ON public.products USING btree (handle);


--
-- TOC entry 3340 (class 1259 OID 16495)
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: shop
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- TOC entry 3335 (class 1259 OID 16483)
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: shop
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- TOC entry 3356 (class 2606 OID 16518)
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- TOC entry 3357 (class 2606 OID 16523)
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- TOC entry 3355 (class 2606 OID 16505)
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3359 (class 2606 OID 16554)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 3360 (class 2606 OID 16559)
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- TOC entry 3358 (class 2606 OID 16540)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: shop
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


-- Completed on 2026-04-25 08:30:56

--
-- PostgreSQL database dump complete
--

\unrestrict 52inq0eXZ9uDyHunCDwfWnT8AiOgFCLzragm4aNdWLq4I6UU0tifAT8FvQbe5Db

