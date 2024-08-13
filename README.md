# Shopify: Frank and Oak Demo

## Description 
A spin-off of the [Frank and Oak store](https://www.frankandoak.com/), showcasing a cart gifts feature created for demo purposes. This also highlights the installation of Selleasy bundles, using the Dawn store as a base theme with some additional customizations.

## Start the project run: 
- Clone the repo
- Run npm install
- Update scripts to use your shopify store
- Run npm run dev to preview

## Main files:
- section/cart-gifts-list.liquid
- snippets/cart-gifts-list.liquid
- assets/cart.js
- assets/cart-drawer.js
- assets/cart-gifts-list.css
- config/settings_schema.liquid

## Testing:
- [Theme Editor](https://frankandoakdemo.myshopify.com/admin/themes/137324363952/editor)
- [Preview Theme](https://frankandoakdemo.myshopify.com/?preview_theme_id=137324363952)
- [Ad for specific customers](https://docs.google.com/presentation/d/1HhwRgvt695Iw7Z1DI4XgVzGOsurL99Mv4uTjbW85dPQ/edit?usp=sharing])
- [Upsell product example](https://frankandoakdemo.myshopify.com/products/the-alpine-parka-in-rosin?_pos=1&_sid=58b305e52&_ss=r)

## Testing scenarios: 
- The admin enables the cart gifts section to appear when a user adds a product to the cart.
- The admin sets a purchase threshold that must be met before the user can see the cart gifts section and add a gift product to the cart.
- The admin sets a utm_medium to target specific customers via an ad. When the user clicks on the ad, they are directed to the store, and the cart gifts section will appear once the user adds a product to the cart.
- The admin sets up bundle products through the Selleasy app. When the user navigates to one of these products, they will see the option to add a bundle to the cart.

