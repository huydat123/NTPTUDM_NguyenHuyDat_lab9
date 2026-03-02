package com.example.Bai5.controller;

import com.example.Bai5.model.Product;
import com.example.Bai5.service.ProductService;
import com.example.Bai5.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@Controller
@RequestMapping("/products")
public class ProductController {

    @Autowired
    private ProductService productService;

    @Autowired
    private CategoryService categoryService;

    @GetMapping
    public String listProducts(Model model) {
        List<Product> productList = productService.getAllProducts();
        model.addAttribute("products", productList);

        return "product/list";
    }

    @GetMapping("/add")
    public String showAddForm(Model model) {
        model.addAttribute("product", new Product());
        model.addAttribute("categories", categoryService.getAllCategories());
        return "product/add";
    }

    @PostMapping("/save")
    public String saveProduct(@ModelAttribute("product") Product product) {
        productService.saveProduct(product);
        return "redirect:/products";
    }

    @GetMapping("/edit/{id}")
    public String showEditForm(@PathVariable("id") Long id, Model model) {
        // 1. Tìm sản phẩm theo ID từ database
        Product product = productService.getProductById(id);
        // 2. Gửi sản phẩm vào Model để hiển thị lên form
        model.addAttribute("product", product);
        // 3. Gửi danh sách categories để chọn lại nếu muốn
        model.addAttribute("categories", categoryService.getAllCategories());
        return "product/edit";
    }

    @GetMapping("/delete/{id}")
    public String deleteProduct(@PathVariable("id") Long id) {
        productService.deleteProduct(id);
        return "redirect:/products";
    }
}