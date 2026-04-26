--
-- Synthetic 120-table schema for exercising FK-cluster chunking (FR-024).
-- Four distinct clusters of 30 tables each, plus a handful of lone reference
-- tables at the end. Generated manually to keep the test deterministic.
--

-- Cluster A ---------------------------------------------------------------
CREATE TABLE a_root (id serial PRIMARY KEY, name text NOT NULL);
CREATE TABLE a_n01 (id serial PRIMARY KEY, parent_id integer REFERENCES a_root(id), data text);
CREATE TABLE a_n02 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n01(id), data text);
CREATE TABLE a_n03 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n02(id), data text);
CREATE TABLE a_n04 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n03(id), data text);
CREATE TABLE a_n05 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n04(id), data text);
CREATE TABLE a_n06 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n05(id), data text);
CREATE TABLE a_n07 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n06(id), data text);
CREATE TABLE a_n08 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n07(id), data text);
CREATE TABLE a_n09 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n08(id), data text);
CREATE TABLE a_n10 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n09(id), data text);
CREATE TABLE a_n11 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n10(id), data text);
CREATE TABLE a_n12 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n11(id), data text);
CREATE TABLE a_n13 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n12(id), data text);
CREATE TABLE a_n14 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n13(id), data text);
CREATE TABLE a_n15 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n14(id), data text);
CREATE TABLE a_n16 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n15(id), data text);
CREATE TABLE a_n17 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n16(id), data text);
CREATE TABLE a_n18 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n17(id), data text);
CREATE TABLE a_n19 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n18(id), data text);
CREATE TABLE a_n20 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n19(id), data text);
CREATE TABLE a_n21 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n20(id), data text);
CREATE TABLE a_n22 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n21(id), data text);
CREATE TABLE a_n23 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n22(id), data text);
CREATE TABLE a_n24 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n23(id), data text);
CREATE TABLE a_n25 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n24(id), data text);
CREATE TABLE a_n26 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n25(id), data text);
CREATE TABLE a_n27 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n26(id), data text);
CREATE TABLE a_n28 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n27(id), data text);
CREATE TABLE a_n29 (id serial PRIMARY KEY, parent_id integer REFERENCES a_n28(id), data text);

-- Cluster B ---------------------------------------------------------------
CREATE TABLE b_root (id serial PRIMARY KEY, name text NOT NULL);
CREATE TABLE b_n01 (id serial PRIMARY KEY, parent_id integer REFERENCES b_root(id), data text);
CREATE TABLE b_n02 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n01(id), data text);
CREATE TABLE b_n03 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n02(id), data text);
CREATE TABLE b_n04 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n03(id), data text);
CREATE TABLE b_n05 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n04(id), data text);
CREATE TABLE b_n06 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n05(id), data text);
CREATE TABLE b_n07 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n06(id), data text);
CREATE TABLE b_n08 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n07(id), data text);
CREATE TABLE b_n09 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n08(id), data text);
CREATE TABLE b_n10 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n09(id), data text);
CREATE TABLE b_n11 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n10(id), data text);
CREATE TABLE b_n12 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n11(id), data text);
CREATE TABLE b_n13 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n12(id), data text);
CREATE TABLE b_n14 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n13(id), data text);
CREATE TABLE b_n15 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n14(id), data text);
CREATE TABLE b_n16 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n15(id), data text);
CREATE TABLE b_n17 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n16(id), data text);
CREATE TABLE b_n18 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n17(id), data text);
CREATE TABLE b_n19 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n18(id), data text);
CREATE TABLE b_n20 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n19(id), data text);
CREATE TABLE b_n21 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n20(id), data text);
CREATE TABLE b_n22 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n21(id), data text);
CREATE TABLE b_n23 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n22(id), data text);
CREATE TABLE b_n24 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n23(id), data text);
CREATE TABLE b_n25 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n24(id), data text);
CREATE TABLE b_n26 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n25(id), data text);
CREATE TABLE b_n27 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n26(id), data text);
CREATE TABLE b_n28 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n27(id), data text);
CREATE TABLE b_n29 (id serial PRIMARY KEY, parent_id integer REFERENCES b_n28(id), data text);

-- Cluster C ---------------------------------------------------------------
CREATE TABLE c_root (id serial PRIMARY KEY, name text NOT NULL);
CREATE TABLE c_n01 (id serial PRIMARY KEY, parent_id integer REFERENCES c_root(id), data text);
CREATE TABLE c_n02 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n01(id), data text);
CREATE TABLE c_n03 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n02(id), data text);
CREATE TABLE c_n04 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n03(id), data text);
CREATE TABLE c_n05 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n04(id), data text);
CREATE TABLE c_n06 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n05(id), data text);
CREATE TABLE c_n07 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n06(id), data text);
CREATE TABLE c_n08 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n07(id), data text);
CREATE TABLE c_n09 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n08(id), data text);
CREATE TABLE c_n10 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n09(id), data text);
CREATE TABLE c_n11 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n10(id), data text);
CREATE TABLE c_n12 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n11(id), data text);
CREATE TABLE c_n13 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n12(id), data text);
CREATE TABLE c_n14 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n13(id), data text);
CREATE TABLE c_n15 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n14(id), data text);
CREATE TABLE c_n16 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n15(id), data text);
CREATE TABLE c_n17 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n16(id), data text);
CREATE TABLE c_n18 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n17(id), data text);
CREATE TABLE c_n19 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n18(id), data text);
CREATE TABLE c_n20 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n19(id), data text);
CREATE TABLE c_n21 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n20(id), data text);
CREATE TABLE c_n22 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n21(id), data text);
CREATE TABLE c_n23 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n22(id), data text);
CREATE TABLE c_n24 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n23(id), data text);
CREATE TABLE c_n25 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n24(id), data text);
CREATE TABLE c_n26 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n25(id), data text);
CREATE TABLE c_n27 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n26(id), data text);
CREATE TABLE c_n28 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n27(id), data text);
CREATE TABLE c_n29 (id serial PRIMARY KEY, parent_id integer REFERENCES c_n28(id), data text);

-- Cluster D ---------------------------------------------------------------
CREATE TABLE d_root (id serial PRIMARY KEY, name text NOT NULL);
CREATE TABLE d_n01 (id serial PRIMARY KEY, parent_id integer REFERENCES d_root(id), data text);
CREATE TABLE d_n02 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n01(id), data text);
CREATE TABLE d_n03 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n02(id), data text);
CREATE TABLE d_n04 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n03(id), data text);
CREATE TABLE d_n05 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n04(id), data text);
CREATE TABLE d_n06 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n05(id), data text);
CREATE TABLE d_n07 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n06(id), data text);
CREATE TABLE d_n08 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n07(id), data text);
CREATE TABLE d_n09 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n08(id), data text);
CREATE TABLE d_n10 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n09(id), data text);
CREATE TABLE d_n11 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n10(id), data text);
CREATE TABLE d_n12 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n11(id), data text);
CREATE TABLE d_n13 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n12(id), data text);
CREATE TABLE d_n14 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n13(id), data text);
CREATE TABLE d_n15 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n14(id), data text);
CREATE TABLE d_n16 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n15(id), data text);
CREATE TABLE d_n17 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n16(id), data text);
CREATE TABLE d_n18 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n17(id), data text);
CREATE TABLE d_n19 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n18(id), data text);
CREATE TABLE d_n20 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n19(id), data text);
CREATE TABLE d_n21 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n20(id), data text);
CREATE TABLE d_n22 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n21(id), data text);
CREATE TABLE d_n23 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n22(id), data text);
CREATE TABLE d_n24 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n23(id), data text);
CREATE TABLE d_n25 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n24(id), data text);
CREATE TABLE d_n26 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n25(id), data text);
CREATE TABLE d_n27 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n26(id), data text);
CREATE TABLE d_n28 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n27(id), data text);
CREATE TABLE d_n29 (id serial PRIMARY KEY, parent_id integer REFERENCES d_n28(id), data text);
