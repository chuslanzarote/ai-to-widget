--
-- PostgreSQL database dump (synthetic minimal fixture)
--

\restrict abc123

SET statement_timeout = 0;
SET lock_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';

CREATE TABLE public.product (
    id integer NOT NULL,
    name text,
    price numeric(10,2)
);

ALTER TABLE public.product OWNER TO some_role;

COPY public.product (id, name, price) FROM stdin;
1	Widget A	9.99
2	Widget B	14.50
\.

\unrestrict abc123
