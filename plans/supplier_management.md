Supplier User Flag & Variant Supplier — Brief Plan
1. User Model
Do not introduce a new UserType.

Add a boolean field to the existing Saleor User model:

is_supplier: Boolean
Default:

is_supplier = false
This allows combinations such as:

Customer
  is_supplier = false

Customer + Supplier
  is_supplier = true

Staff
  is_supplier = false

Staff + Supplier
  is_supplier = true
The existing Saleor user/customer/staff behavior remains unchanged.

2. VariantSupplier
Keep VariantSupplier as a separate relationship.

VariantSupplier
---------------
id
variant_id
supplier_user_id
created_at
updated_at
Relationship:

User (is_supplier=true)
        |
        | 1:N
        |
VariantSupplier
        |
        | N:1
        |
ProductVariant
Add:

UNIQUE(variant_id, supplier_user_id)
to prevent duplicate assignments.

3. Supplier Eligibility
A user can be selected as a supplier only when:

User.is_supplier = true
The backend must validate this; Dashboard filtering alone should not be relied upon.

If:

is_supplier = false
the user cannot be newly assigned to a variant.

4. User Dashboard
Add a simple setting to the existing user create/edit form:

Supplier
[ ] This user is a supplier
or:

Is Supplier
[ ON / OFF ]
Supplier filtering can also be added to the Users list:

All
Customers
Staff
Suppliers
A supplier remains whatever their original Saleor user type/role is.

5. Product Dashboard
Add a Suppliers section to the product.

Suppliers

[ Search supplier... ]

☑ Supplier A
☑ Supplier B

[ Assign selected suppliers to all variants ]
Only users with:

is_supplier = true
should appear in the selector.

6. Variant Dashboard
Allow multiple suppliers per variant:

Variant: Red / XL

Suppliers
[x] Supplier A
[x] Supplier B
[ ] Supplier C

[Save]
Each variant can have an independent supplier combination.

Example:

Variant A → Supplier A, Supplier B
Variant B → Supplier B
Variant C → Supplier A, Supplier C
7. Product → All Variants
The product-level action should be a bulk assignment.

If the user selects:

Supplier C
[Assign to all variants]
existing assignments should be preserved.

Example:

Before:
Variant A → A
Variant B → B

After:
Variant A → A, C
Variant B → B, C
It should not establish a permanent inheritance relationship.

8. Removing Supplier Status
If an administrator changes:

is_supplier: true → false
recommended behavior:

Prevent new assignments to this user.
Keep existing VariantSupplier records initially.
Mark the user as unavailable in supplier selectors.
Do not delete historical supplier relationships automatically.
Optionally provide a warning:

This user is currently assigned to variants. Turning off supplier status will prevent new assignments but will not remove existing assignments.
This avoids accidental data loss.

9. Basic API Changes
Expose:

User.isSupplier
and supplier relationships on variants.

Conceptually:

variant {
  suppliers {
    id
    email
    firstName
    lastName
  }
}
Required operations:

Update User.isSupplier
Assign supplier to variant
Remove supplier from variant
Assign suppliers to all product variants
Backend validation:

if user.is_supplier != true:
    reject supplier assignment
10. Basic Conditions
is_supplier is independent of customer/staff status.
Default value is false.
A user may be both customer and supplier.
A user may be both staff and supplier.
A variant can have multiple suppliers.
A supplier can supply multiple variants.
Duplicate variant/supplier assignments are prohibited.
Only is_supplier=true users can be newly assigned.
Inactive users should not be available for new assignments.
Existing assignments should not be automatically deleted when is_supplier becomes false.
Product-level assignment adds suppliers to all variants.
Product-level assignment does not overwrite existing variant assignments.
Variant-level changes affect only the selected variant.
API authorization/validation must enforce the rules independently of Dashboard UI.
:::

I would recommend this model over UserType = SUPPLIER because is_supplier represents a capability/relationship, not an identity category. It also leaves room for future flags such as is_vendor, is_buyer, etc., without interfering with Saleor's existing customer/staff classification.


