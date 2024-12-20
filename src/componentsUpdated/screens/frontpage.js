// Import necessary modules
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { auth, db, storage } from "../../firebase"; // Adjust the import path as needed
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, getDownloadURL } from "firebase/storage";

export default function FrontPage() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  // Adjusted categories to match the UploadProductPage
  const categories = [
    "Textbooks",
    "Lab Materials",
    "Clothes",
    "Dorm Supplies",
    "Other",
  ];

  useEffect(() => {
    // Fetch products from Firestore
    const fetchProducts = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("status", "==", "available")
        );
        const querySnapshot = await getDocs(q);
        const productsData = [];
        querySnapshot.forEach((doc) => {
          productsData.push({ id: doc.id, ...doc.data() });
        });
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    // Fetch current user and profile picture
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user data from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfilePicture(data.profilePicture || null);
        } else {
          console.log("No user data found in Firestore.");
        }
      } else {
        // User is signed out
        navigation.navigate("Login");
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  useEffect(() => {
    // Fetch logo URL from Firebase Storage
    const fetchLogoUrl = async () => {
      try {
        const logoRef = ref(storage, "app_assets/logo.jpg"); // Replace with your logo's path in Firebase Storage
        const url = await getDownloadURL(logoRef);
        setLogoUrl(url);
      } catch (error) {
        console.error("Error fetching logo URL:", error);
      }
    };
    fetchLogoUrl();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory
      ? product.category === selectedCategory
      : true;
    const matchesSearchQuery = searchQuery
      ? product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearchQuery;
  });

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} />
        ) : (
          <Text style={styles.header}>Logo</Text>
        )}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.profilePicture}
            />
          ) : (
            <Image
              source={{
                uri: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png",
              }}
              style={styles.profilePicture}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Centered Title */}
      <Text style={styles.headerTitle}>Scholar Swap</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search Your Class or Materials"
          placeholderTextColor="#FFD700"
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
        />
      </View>

      {/* Categories Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.selectedCategoryButton,
              ]}
              onPress={() => {
                setSelectedCategory(
                  selectedCategory === category ? null : category
                );
              }}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.selectedCategoryText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Available Products Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Products</Text>
        <View style={styles.productGrid}>
          {filteredProducts.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <Image
                source={{ uri: product.image }}
                style={styles.productImage}
              />
              <Text style={styles.productName}>{product.title}</Text>
              <Text style={styles.productPrice}>
                ${product.price ? product.price.toFixed(2) : "N/A"}
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  navigation.navigate("Product", { id: product.id })
                }
              >
                <Text style={styles.buttonText}>View</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    padding: 15,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 15,
    justifyContent: "space-between",
  },
  logo: {
    width: 150, // Increased size
    height: 75,
    resizeMode: "contain",
  },
  profilePicture: {
    width: 75, // Increased size
    height: 75,
    borderRadius: 37.5,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 36, // Increased font size
    fontWeight: "bold",
    color: "#FFD700",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  searchContainer: {
    backgroundColor: "#1C1C1C",
    paddingVertical: 15, // Increased padding for larger size
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
  },
  searchInput: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "500",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    color: "#FFD700",
    marginBottom: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryScroll: {
    flexDirection: "row",
    paddingHorizontal: 5,
  },
  categoryButton: {
    backgroundColor: "#1C1C1C",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  categoryText: {
    color: "#FFD700",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  selectedCategoryButton: {
    backgroundColor: "#FFD700",
  },
  selectedCategoryText: {
    color: "#000",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    width: "48%",
    marginBottom: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  buttonText: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
  },
});
