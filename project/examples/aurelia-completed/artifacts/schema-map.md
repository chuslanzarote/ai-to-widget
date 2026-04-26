# Schema map

## Summary

Four indexable entities plus reference and infrastructure tables.

## Entity: product

Classification: indexable
Source tables: public.product
Joined references: public.product_variant, public.product_category

### Columns

- title: index
- description: index
- handle: reference
- created_at: exclude-internal

### Evidence

Mentioned in brief's business scope and vocabulary; primary catalog table.

## Entity: variant

Classification: indexable
Source tables: public.product_variant
Joined references: public.product

### Columns

- title: index
- sku: reference

### Evidence

Brief vocabulary entry "variant".

## Entity: collection

Classification: indexable
Source tables: public.product_collection
Joined references: (none)

### Columns

- title: index
- handle: reference

### Evidence

Brief vocabulary entry "collection".

## Entity: region

Classification: indexable
Source tables: public.region
Joined references: (none)

### Columns

- name: index
- countries: index

### Evidence

Brief vocabulary entry "region".

## Reference tables

- public.product_category
- public.product_tag

## Infrastructure / ignored

- public.migration
- public.audit_log

## PII-excluded

- public.customer: columns [email, phone, first_name, last_name] — direct PII
- public.customer_address: columns [address_1, city, postal_code] — location PII
