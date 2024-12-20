// Profile.js

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth, db, storage } from '../../firebase'; // Adjust the import path as needed
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { getDownloadURL, ref } from 'firebase/storage';

export default function Profile({ navigation }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profileData, setProfileData] = useState(null); // Firestore user data
  const [isEditingProfile, setIsEditingProfile] = useState(false); // Toggle edit mode
  const [isChangingPassword, setIsChangingPassword] = useState(false); // Toggle password change mode
  const [firstName, setFirstName] = useState(''); // For first name
  const [lastName, setLastName] = useState(''); // For last name
  const [academicYear, setAcademicYear] = useState(''); // For academic year
  const [email, setEmail] = useState(''); // For email
  const [currentPassword, setCurrentPassword] = useState(''); // For current password
  const [newPassword, setNewPassword] = useState(''); // For new password
  const [confirmNewPassword, setConfirmNewPassword] = useState(''); // For confirm new password
  const [errorMessage, setErrorMessage] = useState(''); // For error messages
  const [successMessage, setSuccessMessage] = useState(''); // For success messages
  const [profilePicture, setProfilePicture] = useState(''); // For profile picture URL

  const [listedProducts, setListedProducts] = useState([]); // Products where seller_id == user.uid
  const [orderHistory, setOrderHistory] = useState([]); // Products where buyer_id == user.uid
  const [activeTab, setActiveTab] = useState('listed'); // For tab switching

  const [logoUrl, setLogoUrl] = useState(null); // For logo image URL

  const [conversations, setConversations] = useState([]); // For chats

  useEffect(() => {
    // Fetch logo URL from Firebase Storage
    const fetchLogoUrl = async () => {
      try {
        const logoRef = ref(storage, 'app_assets/logo.jpg'); // Replace with your logo's path in Firebase Storage
        const url = await getDownloadURL(logoRef);
        setLogoUrl(url);
      } catch (error) {
        console.error('Error fetching logo URL:', error);
      }
    };
    fetchLogoUrl();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email); // Set current email in state
        // Fetch additional user data from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData(data);
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setAcademicYear(data.academicYear || 'Freshman');
          setProfilePicture(data.profilePicture || '');
        } else {
          console.log('No user data found in Firestore.');
        }
      } else {
        navigation.navigate('Login');
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  useEffect(() => {
    if (user) {
      // Fetch listed products
      const fetchListedProducts = async () => {
        try {
          const productsRef = collection(db, 'products');
          const q = query(productsRef, where('seller_id', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const products = [];
          querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
          });
          setListedProducts(products);
        } catch (error) {
          console.error('Error fetching listed products:', error);
        }
      };

      // Fetch order history
      const fetchOrderHistory = async () => {
        try {
          const productsRef = collection(db, 'products');
          const q = query(productsRef, where('buyer_id', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const orders = [];
          querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
          });
          setOrderHistory(orders);
        } catch (error) {
          console.error('Error fetching order history:', error);
        }
      };

      // Fetch conversations
      const fetchConversations = () => {
        const conversationsRef = collection(db, 'conversations');
        const q = query(
          conversationsRef,
          where('userIds', 'array-contains', user.uid),
          orderBy('last_message_time', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
          const convos = [];
          for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            let otherUserId;
            let unreadCountField;
            if (data.user1_id === user.uid) {
              otherUserId = data.user2_id;
              unreadCountField = 'unread_count_user1';
            } else {
              otherUserId = data.user1_id;
              unreadCountField = 'unread_count_user2';
            }
            // Fetch other user's name
            const otherUserDocRef = doc(db, 'users', otherUserId);
            const otherUserDoc = await getDoc(otherUserDocRef);
            const otherUserData = otherUserDoc.exists()
              ? otherUserDoc.data()
              : { firstName: 'Unknown', lastName: 'User' };
            convos.push({
              id: docSnap.id,
              otherUserId,
              otherUserName: `${otherUserData.firstName} ${otherUserData.lastName}`,
              lastMessage: data.last_message,
              lastMessageTime: data.last_message_time,
              unreadCount: data[unreadCountField] || 0,
            });
          }
          setConversations(convos);
        });

        return () => {
          unsubscribe();
        };
      };

      fetchListedProducts();
      fetchOrderHistory();
      fetchConversations();
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!firstName || !lastName || !academicYear || !email) {
      setErrorMessage('Please fill out all profile fields.');
      return;
    }

    try {
      // Update email in Firebase Authentication if it has changed
      if (email !== user.email) {
        await updateEmail(user, email);
      }

      // Update profile data in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        firstName,
        lastName,
        academicYear,
        email,
      });

      setSuccessMessage('Profile updated successfully.');
      setIsEditingProfile(false);
      // Refresh user data
      setUser({ ...user, email });
      setProfileData({
        ...profileData,
        firstName,
        lastName,
        academicYear,
        email,
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.code === 'auth/requires-recent-login') {
        setErrorMessage('Please reauthenticate to update your email.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Please enter a valid email address.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already in use by another account.');
      } else {
        setErrorMessage('An error occurred while updating your profile.');
      }
    }
  };

  const handleChangePassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage('Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      setSuccessMessage('Password updated successfully.');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        setErrorMessage('Incorrect current password.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Your new password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/requires-recent-login') {
        setErrorMessage('Please reauthenticate to update your password.');
      } else {
        setErrorMessage('An error occurred while updating your password.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error signing out:', error);
      setErrorMessage('An error occurred while signing out.');
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoImage} />
        ) : (
          <ActivityIndicator size="small" color="#FFD700" />
        )}
        <View style={styles.navLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('FrontPage')}>
            <Text style={styles.navLink}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('UploadProduct')}>
            <Text style={styles.navLink}>Sell</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Image
            style={styles.profileImage}
            source={{
              uri:
                profilePicture ||
                'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
            }}
          />
          {!isEditingProfile && !isChangingPassword && (
            <>
              <Text style={styles.profileName}>
                {`${firstName} ${lastName}`}
              </Text>
              <Text style={styles.universityInfo}>Wake Forest University</Text>
              <Text style={styles.classInfo}>
                {academicYear ? academicYear : 'Freshman'}
              </Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setIsEditingProfile(true);
                  setSuccessMessage('');
                  setErrorMessage('');
                }}
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changePasswordButton}
                onPress={() => {
                  setIsChangingPassword(true);
                  setSuccessMessage('');
                  setErrorMessage('');
                }}
              >
                <Text style={styles.buttonText}>Change Password</Text>
              </TouchableOpacity>
            </>
          )}

          {isEditingProfile && (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>First Name:</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Last Name:</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Academic Year:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={academicYear}
                    style={styles.picker}
                    onValueChange={(itemValue) => setAcademicYear(itemValue)}
                    dropdownIconColor="#FFF"
                    mode="dropdown"
                  >
                    <Picker.Item label="Select Academic Year" value="" color="#999" />
                    <Picker.Item label="Freshman" value="Freshman" color="#FFF" />
                    <Picker.Item label="Sophomore" value="Sophomore" color="#FFF" />
                    <Picker.Item label="Junior" value="Junior" color="#FFF" />
                    <Picker.Item label="Senior" value="Senior" color="#FFF" />
                  </Picker>
                </View>
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email:</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email"
                  placeholderTextColor="#999"
                />
              </View>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
              <View style={styles.profileButtons}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditingProfile(false);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isChangingPassword && (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Current Password:</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Enter current password"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>New Password:</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Enter new password"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Confirm New Password:</Text>
                <TextInput
                  style={styles.input}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  placeholder="Confirm new password"
                  placeholderTextColor="#999"
                />
              </View>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
              <View style={styles.profileButtons}>
                <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsChangingPassword(false);
                    setErrorMessage('');
                    setSuccessMessage('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Chat Section */}
        <View style={styles.chatSection}>
          <Text style={styles.sectionTitle}>Chats</Text>
          {conversations.length > 0 ? (
            conversations.map((convo) => (
              <TouchableOpacity
                key={convo.id}
                style={styles.chatItem}
                onPress={() =>
                  navigation.navigate('Chat', { otherUserId: convo.otherUserId })
                }
              >
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{convo.otherUserName}</Text>
                  {convo.unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.chatTime}>
                  {convo.lastMessageTime
                    ? convo.lastMessageTime.toDate().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noChatsText}>No conversations yet.</Text>
          )}
        </View>

        {/* Tabs for Listed Products and Order History */}
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setActiveTab('listed')}>
            <Text style={[styles.tab, activeTab === 'listed' && styles.activeTab]}>
              Your Listed Products
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('orders')}>
            <Text style={[styles.tab, activeTab === 'orders' && styles.activeTab]}>
              Your Order History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Product Listings */}
        <View style={styles.productList}>
          {activeTab === 'listed' ? (
            listedProducts.length > 0 ? (
              listedProducts.map((product) => (
                <View key={product.id} style={styles.productItem}>
                  {product.image && (
                    <Image style={styles.productImage} source={{ uri: product.image }} />
                  )}
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{product.title}</Text>
                    <Text style={styles.productPrice}>
                      ${product.price ? product.price.toFixed(2) : 'N/A'}
                    </Text>
                    <Text style={styles.productStatus}>Status: {product.status}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>
                  You haven't listed any products yet -{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('UploadProduct')}>
                  <Text style={styles.linkText}>List a Product</Text>
                </TouchableOpacity>
              </View>
            )
          ) : activeTab === 'orders' ? (
            orderHistory.length > 0 ? (
              orderHistory.map((order) => (
                <View key={order.id} style={styles.productItem}>
                  {order.image && (
                    <Image style={styles.productImage} source={{ uri: order.image }} />
                  )}
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{order.title}</Text>
                    <Text style={styles.productPrice}>
                      ${order.price ? order.price.toFixed(2) : 'N/A'}
                    </Text>
                    <Text style={styles.productStatus}>Status: {order.status}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>
                  You haven't ordered any products yet -{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('FrontPage')}>
                  <Text style={styles.linkText}>Browse Products</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>

        {/* Sign-Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#222', // Dark background
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#000', // Black background for nav bar
  },
  logoImage: {
    width: 120, // Adjust as needed
    height: 60,
    resizeMode: 'contain',
  },
  navLinks: {
    flexDirection: 'row',
  },
  navLink: {
    fontSize: 18,
    color: '#FFD700', // Gold text
    marginHorizontal: 15,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  profileImage: {
    width: 120, // Increased size
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 24, // Increased font size
    fontWeight: 'bold',
    color: '#FFD700', // Gold color
  },
  universityInfo: {
    fontSize: 16,
    color: '#CCC',
  },
  classInfo: {
    fontSize: 14,
    color: '#AAA',
  },
  fieldContainer: {
    width: '100%',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderColor: '#555',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    color: '#FFF',
    backgroundColor: '#333',
  },
  pickerContainer: {
    borderColor: '#555',
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  picker: {
    height: 50,
    color: '#FFF',
    backgroundColor: '#333', // Dark background for picker
  },
  profileButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    width: '15%',
  },
  saveButton: {
    backgroundColor: '#28a745', // Green
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 10,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#dc3545', // Red
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1,
  },
  editButton: {
    backgroundColor: '#007bff', // Blue
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 20,
    width: '100%',
  },
  changePasswordButton: {
    backgroundColor: '#6c757d', // Grey
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    width: '100%',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  successText: {
    color: 'green',
    marginBottom: 10,
    textAlign: 'center',
  },
  chatSection: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  chatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#444',
    borderBottomWidth: 1,
  },
  chatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    color: '#FFF',
  },
  chatTime: {
    fontSize: 14,
    color: '#777',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
    marginLeft: 10,
  },
  noChatsText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  tab: {
    fontSize: 16,
    color: '#FFD700',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#FFD700',
  },
  productList: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 10,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    color: '#FFF',
  },
  productPrice: {
    fontSize: 14,
    color: '#AAA',
  },
  productStatus: {
    fontSize: 14,
    color: '#AAA',
  },
  placeholderContainer: {
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
  },
  linkText: {
    fontSize: 16,
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
  signOutButton: {
    backgroundColor: '#dc3545', // Red
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
});
