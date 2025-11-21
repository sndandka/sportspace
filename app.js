// ======== KONFIGURASI FIREBASE ========
const firebaseConfig = {
    apiKey: "AIzaSyCC_w-HS2v_yQAl_mZllSHFZ4RtcywLn2Q",
    authDomain: "peminjaman-alat-olahraga.firebaseapp.com",
    projectId: "peminjaman-alat-olahraga",
    storageBucket: "peminjaman-alat-olahraga.firebasestorage.app",
    messagingSenderId: "243156686089",
    appId: "1:243156686089:web:d678eef4abb77fe653efd8",
    measurementId: "G-N1GJ5YZX1T"
};

// Cek jika konfigurasi masih default
if (firebaseConfig.apiKey === "GANTI_DENGAN_API_KEY_ANDA") {
    document.body.innerHTML = '<div class="p-8 text-center text-red-600 font-bold">Error: Konfigurasi Firebase belum diatur. Silakan edit file HTML dan masukkan konfigurasi Firebase Anda.</div>';
}

// Impor modul yang diperlukan
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query, 
    where, 
    onSnapshot,
    serverTimestamp,
    limit,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variabel Global
let currentUser = null;
let userRole = 'User'; // Default role
let userDocRef = null;
let unsubscribeListeners = []; // Untuk menyimpan semua listener

let globalAlatData = []; // Variabel global untuk menyimpan data alat
let globalPeminjamanData = []; // Variabel global untuk menyimpan data peminjaman

// Variabel untuk menyimpan file gambar yang dipilih
let selectedImageFile = null;

// Variabel global untuk pengaturan
let pengaturanSistem = {
    dendaPerHari: 5000
};

// Path koleksi
const penggunaCollectionPath = "pengguna";
const alatCollectionPath = "alat";
const peminjamanCollectionPath = "peminjaman";
const pengaturanCollectionPath = "pengaturan";

// ===================================
// Fungsi Helper (UI & Utility)
// ===================================

function showLoader(show) {
    const loader = document.getElementById('global-loader-container');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function showSuccessMessage(message) {
    const el = document.getElementById('global-message-success');
    const textEl = document.getElementById('global-message-success-text');
    if (el && textEl) {
        textEl.textContent = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
}

function showErrorMessage(message) {
    const el = document.getElementById('global-message-error');
    const textEl = document.getElementById('global-message-error-text');
    if (el && textEl) {
        textEl.textContent = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

let confirmationCallback = null;

function showConfirmationMessage(message, callback) {
    const messageEl = document.getElementById('global-confirmation-message');
    const container = document.getElementById('global-confirmation-container');
    
    if (messageEl && container) {
        messageEl.textContent = message;
        confirmationCallback = callback;
        container.classList.remove('hidden');
    }
}

function formatTanggal(date) {
    if (!date) return '-';
    if (date.toDate) {
        date = date.toDate();
    }
    if (date instanceof Date) {
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return '-';
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function selisihHari(dateA, dateB) {
    if (!dateA || !dateB) return 0;
    
    try {
        const _MS_PER_DAY = 1000 * 60 * 60 * 24;
        
        let date1, date2;
        
        // Convert dateA
        if (dateA.toDate) {
            date1 = dateA.toDate();
        } else if (dateA instanceof Date) {
            date1 = dateA;
        } else {
            date1 = new Date(dateA);
        }
        
        // Convert dateB
        if (dateB.toDate) {
            date2 = dateB.toDate();
        } else if (dateB instanceof Date) {
            date2 = dateB;
        } else {
            date2 = new Date(dateB);
        }
        
        // Validate dates
        if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
            return 0;
        }
        
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor((utc2 - utc1) / _MS_PER_DAY);
    } catch (error) {
        console.error("Error menghitung selisih hari:", error);
        return 0;
    }
}

function tambahHari(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatTanggalInput(date) {
    if (!date) return '';
    if (date.toDate) {
        date = date.toDate();
    }
    return date.toISOString().split('T')[0];
}

// Helper function untuk konversi file ke base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ===================================
// Navigasi Halaman
// ===================================

// Fungsi untuk menampilkan halaman
window.showPage = (pageId) => {
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    let newTitle = 'Dashboard';
    if (pageId === 'page-alat') {
        newTitle = 'Kelola Alat Olahraga';
        // Pastikan data alat dirender ketika berpindah ke halaman alat
        if (userRole === 'Admin' && globalAlatData.length > 0) {
            renderAlatTable(globalAlatData);
        }
    }
    else if (pageId === 'page-peminjaman') newTitle = 'Pinjam Alat';
    else if (pageId === 'page-kelola-pengembalian') newTitle = 'Kelola Pengembalian';
    else if (pageId === 'page-riwayat') newTitle = 'Riwayat Peminjaman';
    else if (pageId === 'page-persetujuan') newTitle = 'Persetujuan Peminjaman';
    else if (pageId === 'page-laporan') newTitle = 'Laporan & Statistik';
    else if (pageId === 'page-pengguna') newTitle = 'Manajemen Pengguna';
    else if (pageId === 'page-denda') newTitle = 'Pengaturan Denda';
    
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        pageTitleEl.textContent = newTitle;
    }
    
    const allNavLinks = document.querySelectorAll('#nav-links-container .nav-link');
    allNavLinks.forEach(link => {
        link.classList.remove('bg-blue-900');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(pageId)) {
            link.classList.add('bg-blue-900');
        }
    });

    // Tutup sidebar di perangkat mobile
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    
    // Refresh data jika pindah ke halaman yang membutuhkan data terbaru
    if (pageId === 'page-riwayat') {
        refreshPeminjamanData();
    }
    
    // Refresh data admin ketika berpindah ke halaman admin
    if (userRole === 'Admin' && (
        pageId === 'page-persetujuan' || 
        pageId === 'page-laporan' || 
        pageId === 'page-pengguna' ||
        pageId === 'page-kelola-pengembalian'
    )) {
        refreshAdminData();
    }
};

// Fungsi untuk menampilkan tab login/register
window.showTab = (tabName) => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    
    if (tabName === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
    } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
    }
};

// ===================================
// Fungsi Render untuk berbagai halaman
// ===================================

function renderStatusSpan(peminjaman) {
    if (peminjaman.status === 'Dikembalikan') {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-returned">Dikembalikan</span>`;
    } else if (peminjaman.status === 'Menunggu Persetujuan') {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-waiting">Menunggu Persetujuan</span>`;
    } else if (peminjaman.status === 'Ditolak') {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-rejected">Ditolak</span>`;
    }

    // Cek jika terlambat
    if (peminjaman.tglBatasKembali) {
        try {
            let batasKembali;
            if (peminjaman.tglBatasKembali.toDate) {
                batasKembali = peminjaman.tglBatasKembali.toDate();
            } else if (peminjaman.tglBatasKembali instanceof Date) {
                batasKembali = peminjaman.tglBatasKembali;
            } else {
                batasKembali = new Date(peminjaman.tglBatasKembali);
            }
            
            const today = new Date();
            if (batasKembali < today) {
                return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-rejected">Terlambat</span>`;
            }
        } catch (error) {
            console.error("Error render status:", error);
        }
    }
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full status-approved">Dipinjam</span>`;
}

function renderKondisiSpan(kondisi) {
    let color = 'bg-green-100 text-green-800';
    if (kondisi === 'Rusak Ringan') color = 'bg-yellow-100 text-yellow-800';
    if (kondisi === 'Rusak Berat') color = 'bg-red-100 text-red-800';
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}">${kondisi}</span>`;
}

// ===================================
// Inisialisasi Aplikasi
// ===================================

function setupUIForUser() {
    const adminElements = document.querySelectorAll('.admin-only');
    if (userRole === 'Admin') {
        adminElements.forEach(el => el.style.display = 'block');
    } else {
        adminElements.forEach(el => el.style.display = 'none');
    }
}

async function initAppSettings() {
    try {
        const docRef = doc(db, pengaturanCollectionPath, "sistem");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            pengaturanSistem = docSnap.data();
            console.log("Pengaturan dimuat:", pengaturanSistem);
        } else {
            console.warn("Dokumen pengaturan tidak ditemukan. Menggunakan default.");
            if (userRole === 'Admin') {
                await setDoc(docRef, pengaturanSistem);
            }
        }
    } catch (error) {
        console.error("Gagal memuat pengaturan:", error);
    }
    
    if (userRole === 'Admin') {
        const dendaInput = document.getElementById('denda-per-hari');
        if (dendaInput) {
            dendaInput.value = pengaturanSistem.dendaPerHari;
        }
    }
}

function stopListeners() {
    console.log("Menghentikan semua listener Firestore...");
    unsubscribeListeners.forEach(unsub => {
        try {
            unsub();
        } catch (error) {
            console.error("Error menghentikan listener:", error);
        }
    });
    unsubscribeListeners = [];
}

// Fungsi untuk inisialisasi data admin
async function initAdminData() {
    if (userRole !== 'Admin') return;
    
    try {
        console.log("Inisialisasi data admin...");
        
        // Muat data alat jika belum dimuat
        if (globalAlatData.length === 0) {
            const alatSnapshot = await getDocs(collection(db, alatCollectionPath));
            const alatData = alatSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                stokTotal: doc.data().stokTotal || 0,
                stokTersedia: doc.data().stokTersedia || 0
            }));
            globalAlatData = alatData;
            console.log("Data alat dimuat:", alatData.length, "alat");
            renderAlatTable(alatData);
        }
        
        // Muat data pengguna
        const penggunaSnapshot = await getDocs(collection(db, penggunaCollectionPath));
        const penggunaData = penggunaSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        renderPenggunaPage(penggunaData);
        
        // Muat data peminjaman untuk persetujuan
        const peminjamanSnapshot = await getDocs(
            query(collection(db, peminjamanCollectionPath), 
            where("status", "==", "Menunggu Persetujuan"))
        );
        const peminjamanData = peminjamanSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderPersetujuanPage(peminjamanData);
        
        // Muat semua data peminjaman untuk laporan
        const semuaPeminjamanSnapshot = await getDocs(
            query(collection(db, peminjamanCollectionPath),
            orderBy("createdAt", "desc")
        ));
        
        const semuaPeminjamanData = semuaPeminjamanSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderLaporanPage(semuaPeminjamanData);
        
        // Muat data peminjaman aktif untuk kelola pengembalian
        const peminjamanAktifSnapshot = await getDocs(
            query(collection(db, peminjamanCollectionPath),
            where("status", "==", "Dipinjam")
        ));
        const peminjamanAktifData = peminjamanAktifSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderKelolaPengembalianPage(peminjamanAktifData);
        
    } catch (error) {
        console.error("Error inisialisasi data admin:", error);
    }
}

// Fungsi untuk refresh data admin
function refreshAdminData() {
    if (userRole !== 'Admin') return;
    
    if (globalAlatData.length > 0) {
        renderAlatTable(globalAlatData);
    }
    
    // Refresh data persetujuan
    const menungguPersetujuan = globalPeminjamanData.filter(p => p.status === 'Menunggu Persetujuan');
    renderPersetujuanPage(menungguPersetujuan);
    
    // Refresh data laporan
    renderLaporanPage(globalPeminjamanData);
    
    // Refresh data kelola pengembalian
    const peminjamanAktif = globalPeminjamanData.filter(p => p.status === 'Dipinjam');
    renderKelolaPengembalianPage(peminjamanAktif);
}

// Listener yang diperbaiki
function initListeners(userId) {
    stopListeners();
    console.log("Memulai listener Firestore untuk user:", userId, "Role:", userRole);

    // 1. Listener Alat
    const qAlat = query(collection(db, alatCollectionPath));
    const unsubAlat = onSnapshot(qAlat, (snapshot) => {
        console.log("Listener Alat: Menerima", snapshot.docs.length, "data alat");
        const alatData = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            stokTotal: doc.data().stokTotal || 0,
            stokTersedia: doc.data().stokTersedia || 0
        }));
        
        globalAlatData = alatData; 
        
        // Selalu render tabel alat jika user adalah admin
        if (userRole === 'Admin') {
            renderAlatTable(alatData);
        }

        // Render halaman peminjaman
        const searchTerm = document.getElementById('search-peminjaman-input')?.value.toLowerCase() || '';
        const filteredAlat = searchTerm
            ? globalAlatData.filter(alat => alat.nama.toLowerCase().includes(searchTerm))
            : globalAlatData;
            
        renderPeminjamanPage(filteredAlat); 
        
        updateDashboardStats(alatData, null, null);
    }, (error) => {
        console.error("Error listener alat:", error);
        showErrorMessage("Gagal memuat data alat");
    });
    unsubscribeListeners.push(unsubAlat);

    // 2. Listener Peminjaman
    let qPeminjaman;
    if (userRole === 'Admin') {
        // Admin bisa melihat semua peminjaman
        qPeminjaman = query(
            collection(db, peminjamanCollectionPath), 
            orderBy("createdAt", "desc")
        );
    } else {
        // User hanya melihat peminjamannya sendiri
        qPeminjaman = query(
            collection(db, peminjamanCollectionPath), 
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
    }
    
    const unsubPeminjaman = onSnapshot(qPeminjaman, (snapshot) => {
        console.log("Listener Peminjaman: Menerima", snapshot.docs.length, "data peminjaman");
        
        const peminjamanData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId || '',
                namaPeminjam: data.namaPeminjam || 'Tidak diketahui',
                alatId: data.alatId || '',
                namaAlat: data.namaAlat || 'Alat tidak diketahui',
                tujuanPeminjaman: data.tujuanPeminjaman || '',
                lokasiPenggunaan: data.lokasiPenggunaan || '',
                tglPinjam: data.tglPinjam || null,
                tglBatasKembali: data.tglBatasKembali || null,
                tglKembali: data.tglKembali || null,
                jumlah: data.jumlah || 1,
                status: data.status || 'Menunggu Persetujuan',
                denda: data.denda || 0,
                createdAt: data.createdAt || null
            };
        });

        globalPeminjamanData = peminjamanData; 
        console.log("Data peminjaman yang dimuat:", peminjamanData);

        // Untuk dashboard dan halaman lainnya, gunakan data yang sesuai dengan role
        const peminjamanSaya = (userRole === 'Admin') 
            ? peminjamanData.filter(p => p.userId === userId)
            : peminjamanData;
        
        const { dipinjam, terlambat } = hitungStatusPeminjaman(peminjamanSaya);
        
        // Render berbagai halaman
        renderDashboardPinjamanSaya(peminjamanSaya);
        renderRiwayatPage(peminjamanSaya);
        
        if (userRole === 'Admin') {
            renderPersetujuanPage(peminjamanData.filter(p => p.status === 'Menunggu Persetujuan'));
            renderLaporanPage(peminjamanData);
            renderKelolaPengembalianPage(peminjamanData.filter(p => p.status === 'Dipinjam'));
        }
        
        updateDashboardStats(null, { 
            dipinjam: dipinjam.length, 
            terlambat: terlambat.length, 
            totalPeminjaman: peminjamanSaya.length 
        }, null);
        
    }, (error) => {
        console.error("Error listener peminjaman:", error);
        showErrorMessage("Gagal memuat data peminjaman");
        
        // Fallback: Tampilkan pesan error di tabel
        const errorMessage = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error memuat data. Periksa koneksi atau aturan Firestore.</td></tr>';
        document.querySelectorAll('#dashboard-pinjaman-saya, #riwayat-table-body').forEach(tbody => {
            if (tbody) {
                tbody.innerHTML = errorMessage;
            }
        });
    });
    unsubscribeListeners.push(unsubPeminjaman);

    // 3. Listener Pengguna (Hanya Admin)
    if (userRole === 'Admin') {
        const qPengguna = query(collection(db, penggunaCollectionPath));
        const unsubPengguna = onSnapshot(qPengguna, (snapshot) => {
            console.log("Listener Pengguna (Admin): Menerima", snapshot.docs.length, "data pengguna");
            const penggunaData = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            renderPenggunaPage(penggunaData);
            updateDashboardStats(null, null, penggunaData.length);
            
        }, (error) => {
            console.error("Error listener pengguna:", error);
        });
        unsubscribeListeners.push(unsubPengguna);
    }
}

// Fungsi untuk refresh data peminjaman
function refreshPeminjamanData() {
    if (globalPeminjamanData.length > 0) {
        const peminjamanSaya = (userRole === 'Admin') 
            ? globalPeminjamanData.filter(p => p.userId === currentUser.uid)
            : globalPeminjamanData;
        
        renderRiwayatPage(peminjamanSaya);
    }
}

// ===================================
// Fungsi Perhitungan & Render (Logika Inti)
// ===================================

// --- Dashboard ---

let stats = { totalAlat: 0, dipinjam: 0, totalPeminjaman: 0, terlambat: 0 };

function updateDashboardStats(alatData, pinjamData, totalPeminjam) {
    if (alatData) {
        stats.totalAlat = alatData.reduce((sum, alat) => sum + (alat.stokTotal || 0), 0);
    }
    if (pinjamData) {
        stats.dipinjam = pinjamData.dipinjam;
        stats.terlambat = pinjamData.terlambat;
        stats.totalPeminjaman = pinjamData.totalPeminjaman;
    }
    if (totalPeminjam !== null && totalPeminjam !== undefined) {
        // stats.totalPeminjam = totalPeminjam;
    }

    document.getElementById('stat-total-alat').textContent = stats.totalAlat;
    document.getElementById('stat-alat-dipinjam').textContent = stats.dipinjam;
    document.getElementById('stat-total-peminjaman').textContent = stats.totalPeminjaman;
    document.getElementById('stat-terlambat').textContent = stats.terlambat;
}

function hitungStatusPeminjaman(peminjamanData) {
    const today = new Date();
    let dipinjam = [];
    let terlambat = [];
    
    peminjamanData.forEach(p => {
        if (p.status === 'Dipinjam') {
            dipinjam.push(p);
            
            // Cek keterlambatan
            if (p.tglBatasKembali) {
                try {
                    let batasKembali;
                    if (p.tglBatasKembali.toDate) {
                        batasKembali = p.tglBatasKembali.toDate();
                    } else if (p.tglBatasKembali instanceof Date) {
                        batasKembali = p.tglBatasKembali;
                    } else {
                        batasKembali = new Date(p.tglBatasKembali);
                    }
                    
                    if (batasKembali < today) {
                        terlambat.push(p);
                    }
                } catch (error) {
                    console.error("Error menghitung keterlambatan:", error);
                }
            }
        }
    });
    
    return { dipinjam, terlambat };
}

function renderDashboardPinjamanSaya(peminjamanSaya) {
    const tbody = document.getElementById('dashboard-pinjaman-saya');
    if (!tbody) return;
    
    const aktif = peminjamanSaya.filter(p => p.status === 'Dipinjam' || p.status === 'Menunggu Persetujuan');
    
    if (aktif.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Tidak ada peminjaman aktif.</td></tr>';
        return;
    }
    
    tbody.innerHTML = aktif.map(p => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaAlat}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglPinjam)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglBatasKembali)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${renderStatusSpan(p)}
            </td>
        </tr>
    `).join('');
}

// --- Kelola Alat (Admin) ---

function renderAlatTable(alatData) {
    const tbody = document.getElementById('alat-table-body');
    if (!tbody) return;
    
    if (alatData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Belum ada alat. Silakan tambahkan.</td></tr>';
        return;
    }
    
    tbody.innerHTML = alatData.map(alat => {
        // Handle gambar - jika base64, gunakan langsung, jika URL gunakan URL
        const gambarSrc = alat.gambarType === 'base64' ? alat.gambar : (alat.gambar || 'https://placehold.co/40x40/60a5fa/ffffff?text=Alat');
        
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full object-cover" src="${gambarSrc}" alt="${alat.nama}" onerror="this.src='https://placehold.co/40x40/60a5fa/ffffff?text=Alat'">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${alat.nama}</div>
                            <div class="text-sm text-gray-500">${alat.lokasi || 'Lokasi tidak diset'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${alat.stokTotal}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${alat.stokTersedia}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${renderKondisiSpan(alat.kondisi)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button onclick="handleEditAlat('${alat.id}')" class="text-blue-600 hover:text-blue-900">Edit</button>
                    <button onclick="handleHapusAlat('${alat.id}', '${alat.nama}')" class="text-red-600 hover:text-red-900">Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ===================================
// Event Listeners untuk UI Elements
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded - SportSpace");
    
    // Setup confirmation buttons
    const confirmContainer = document.getElementById('global-confirmation-container');
    const confirmBtn = document.getElementById('global-confirmation-confirm');
    const cancelBtn = document.getElementById('global-confirmation-cancel');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirmContainer) confirmContainer.classList.add('hidden');
            confirmationCallback = null;
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (typeof confirmationCallback === 'function') {
                confirmationCallback();
            }
            if (confirmContainer) confirmContainer.classList.add('hidden');
            confirmationCallback = null;
        });
    }

    // Tombol untuk pergi ke halaman login dari landing page
    document.getElementById('btn-to-login')?.addEventListener('click', () => {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-page').classList.remove('hidden');
    });
    
    document.getElementById('btn-to-login2')?.addEventListener('click', () => {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-page').classList.remove('hidden');
    });
    
    document.getElementById('btn-to-login3')?.addEventListener('click', () => {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('auth-page').classList.remove('hidden');
    });
    
    document.getElementById('btn-learn-more')?.addEventListener('click', () => {
        document.getElementById('fitur-section').scrollIntoView({ behavior: 'smooth' });
    });

    // Tombol untuk kembali ke landing page dari auth page
    document.getElementById('btn-back-to-landing')?.addEventListener('click', () => {
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('landing-page').classList.remove('hidden');
    });
    
    document.getElementById('btn-back-to-landing2')?.addEventListener('click', () => {
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('landing-page').classList.remove('hidden');
    });

    // Menu mobile
    document.getElementById('mobile-menu-button')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.remove('hidden');
    });
    
    // Tombol tutup sidebar
    document.getElementById('close-sidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    });
    
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    });

    // Handler Logout
    document.getElementById('logout-button')?.addEventListener('click', async () => {
        showLoader(true);
        try {
            await signOut(auth);
            showSuccessMessage("Berhasil logout");
        } catch (error) {
            console.error("Error logout:", error);
            showErrorMessage("Gagal logout: " + error.message);
        } finally {
            showLoader(false);
        }
    });

    // Handler Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error login:", error);
            showErrorMessage("Gagal login: " + error.message);
            showLoader(false);
        }
    });

    // Handler Pendaftaran
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        const nama = document.getElementById('register-nama').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            await updateProfile(user, { displayName: nama });

            await setDoc(doc(db, penggunaCollectionPath, user.uid), {
                uid: user.uid,
                nama: nama,
                email: email,
                peran: 'User',
                createdAt: serverTimestamp()
            });
            
            showSuccessMessage("Akun berhasil dibuat! Silakan login.");
            showTab('login');
            
        } catch (error) {
            console.error("Error registrasi:", error);
            showErrorMessage("Gagal mendaftar: " + error.message);
        } finally {
            showLoader(false);
        }
    });

    // Kelola Alat - Tambah Alat
    document.getElementById('btn-tambah-alat')?.addEventListener('click', () => {
        document.getElementById('form-alat').reset();
        document.getElementById('form-alat-id').value = '';
        document.getElementById('modal-alat-title').textContent = 'Tambah Alat Baru';
        
        // Reset gambar
        selectedImageFile = null;
        document.getElementById('form-alat-gambar-file').value = '';
        document.getElementById('gambar-preview-container').classList.add('hidden');
        document.getElementById('form-alat-gambar-url').value = '';
        
        document.getElementById('modal-alat').classList.remove('hidden');
    });

    // Kelola Alat - Batal
    document.getElementById('btn-batal-alat')?.addEventListener('click', () => {
        document.getElementById('modal-alat').classList.add('hidden');
    });

    // Upload Gambar
    const fileInput = document.getElementById('form-alat-gambar-file');
    const pilihGambarBtn = document.getElementById('btn-pilih-gambar');
    const previewContainer = document.getElementById('gambar-preview-container');
    const previewImage = document.getElementById('gambar-preview');
    const gambarInfo = document.getElementById('gambar-info');
    const hapusGambarBtn = document.getElementById('btn-hapus-gambar');
    const urlInput = document.getElementById('form-alat-gambar-url');

    // Buka file dialog saat tombol diklik
    if (pilihGambarBtn) {
        pilihGambarBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Handle file selection
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validasi tipe file
                if (!file.type.startsWith('image/')) {
                    showErrorMessage('Harap pilih file gambar yang valid (JPEG, PNG, dll)');
                    return;
                }

                // Validasi ukuran file (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showErrorMessage('Ukuran file terlalu besar. Maksimal 2MB');
                    return;
                }

                selectedImageFile = file;
                
                // Tampilkan preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewImage.classList.remove('hidden');
                    gambarInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    previewContainer.classList.remove('hidden');
                    
                    // Kosongkan URL input jika ada
                    urlInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Hapus gambar yang dipilih
    if (hapusGambarBtn) {
        hapusGambarBtn.addEventListener('click', () => {
            selectedImageFile = null;
            fileInput.value = '';
            previewImage.classList.add('hidden');
            previewContainer.classList.add('hidden');
            gambarInfo.textContent = '';
        });
    }

    // Jika URL diisi, hapus file yang dipilih
    if (urlInput) {
        urlInput.addEventListener('input', () => {
            if (urlInput.value) {
                selectedImageFile = null;
                fileInput.value = '';
                previewImage.classList.add('hidden');
                previewContainer.classList.add('hidden');
                gambarInfo.textContent = '';
            }
        });
    }

    // Form Alat
    document.getElementById('form-alat')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole !== 'Admin') return showErrorMessage("Hanya Admin yang bisa mengubah data alat.");
        
        showLoader(true);
        const id = document.getElementById('form-alat-id').value;
        const stokTotal = parseInt(document.getElementById('form-alat-stok').value);
        
        const data = {
            nama: document.getElementById('form-alat-nama').value,
            deskripsi: document.getElementById('form-alat-deskripsi').value,
            stokTotal: stokTotal,
            kondisi: document.getElementById('form-alat-kondisi').value,
            lokasi: document.getElementById('form-alat-lokasi').value,
        };
        
        try {
            // Handle gambar - prioritas: file > URL > existing gambar
            const urlInput = document.getElementById('form-alat-gambar-url').value;
            
            if (selectedImageFile) {
                // Upload gambar ke Firebase Storage (implementasi sederhana - konversi ke base64)
                const base64Image = await convertFileToBase64(selectedImageFile);
                data.gambar = base64Image; // Simpan sebagai base64 sementara
                data.gambarType = 'base64';
            } else if (urlInput) {
                data.gambar = urlInput;
                data.gambarType = 'url';
            } else if (id) {
                // Jika edit dan tidak ada gambar baru, pertahankan gambar lama
                const existingAlat = globalAlatData.find(a => a.id === id);
                if (existingAlat && existingAlat.gambar) {
                    data.gambar = existingAlat.gambar;
                    data.gambarType = existingAlat.gambarType || 'url';
                }
            }
            
            if (id) {
                const alatRef = doc(db, alatCollectionPath, id);
                const alatSnap = await getDoc(alatRef);
                if(!alatSnap.exists()) throw new Error("Alat tidak ditemukan untuk diupdate.");
                
                const dataLama = alatSnap.data();
                const dipinjam = (dataLama.stokTotal || 0) - (dataLama.stokTersedia || 0);
                
                if (stokTotal < dipinjam) {
                    throw new Error(`Stok total tidak bisa kurang dari jumlah yang sedang dipinjam (${dipinjam}).`);
                }
                data.stokTersedia = stokTotal - dipinjam;
                
                await updateDoc(alatRef, data);
                showSuccessMessage("Data alat berhasil diperbarui.");
                
            } else {
                data.stokTersedia = data.stokTotal; 
                await addDoc(collection(db, alatCollectionPath), data);
                showSuccessMessage("Alat baru berhasil ditambahkan.");
            }
            
            // Reset form gambar
            selectedImageFile = null;
            document.getElementById('form-alat-gambar-file').value = '';
            document.getElementById('gambar-preview-container').classList.add('hidden');
            document.getElementById('form-alat-gambar-url').value = '';
            
            document.getElementById('modal-alat').classList.add('hidden');
        } catch (error) {
            console.error("Gagal simpan alat:", error);
            showErrorMessage("Gagal simpan alat: " + error.message);
        } finally {
            showLoader(false);
        }
    });

    // Peminjaman - Batal Detail
    document.getElementById('btn-batal-detail')?.addEventListener('click', () => {
        document.getElementById('modal-detail-peminjaman').classList.add('hidden');
    });

    // Pencarian alat
    const searchInput = document.getElementById('search-peminjaman-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredAlat = globalAlatData.filter(alat => 
                alat.nama.toLowerCase().includes(searchTerm)
            );
            renderPeminjamanPage(filteredAlat);
        });
    }

    // Form Detail Peminjaman
    document.getElementById('form-detail-peminjaman')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const alatId = document.getElementById('detail-alat-id').value;
        const namaAlat = document.getElementById('detail-alat-nama').value;
        const tujuan = document.getElementById('detail-tujuan').value;
        const lokasiPenggunaan = document.getElementById('detail-lokasi-penggunaan').value;
        const tanggalPinjam = new Date(document.getElementById('detail-tanggal-pinjam').value);
        const tanggalKembali = new Date(document.getElementById('detail-tanggal-kembali').value);
        const jumlah = parseInt(document.getElementById('detail-jumlah').value);
        
        // Validasi tanggal
        if (tanggalPinjam >= tanggalKembali) {
            showErrorMessage("Tanggal kembali harus setelah tanggal pinjam.");
            return;
        }
        
        // Validasi jumlah
        if (jumlah <= 0) {
            showErrorMessage("Jumlah barang harus lebih dari 0.");
            return;
        }
        
        showLoader(true);
        
        try {
            const alatRef = doc(db, alatCollectionPath, alatId);
            const alatSnap = await getDoc(alatRef);
            if (!alatSnap.exists() || (alatSnap.data().stokTersedia || 0) < jumlah) {
                throw new Error("Maaf, stok alat ini tidak mencukupi atau alat tidak ditemukan.");
            }
            
            // Simpan data peminjaman dengan status "Menunggu Persetujuan"
            const peminjamanRef = await addDoc(collection(db, peminjamanCollectionPath), {
                userId: currentUser.uid,
                namaPeminjam: currentUser.displayName,
                alatId: alatId,
                namaAlat: namaAlat,
                tujuanPeminjaman: tujuan,
                lokasiPenggunaan: lokasiPenggunaan,
                tglPinjam: tanggalPinjam,
                tglBatasKembali: tanggalKembali,
                jumlah: jumlah,
                status: "Menunggu Persetujuan",
                denda: 0,
                createdAt: serverTimestamp()
            });
            
            // Tampilkan bukti peminjaman
            tampilkanBuktiPeminjaman({
                id: peminjamanRef.id,
                namaPeminjam: currentUser.displayName,
                namaAlat: namaAlat,
                tujuan: tujuan,
                lokasi: lokasiPenggunaan,
                tanggalPinjam: tanggalPinjam,
                tanggalKembali: tanggalKembali,
                jumlah: jumlah,
                status: "Menunggu Persetujuan"
            });
            
            document.getElementById('modal-detail-peminjaman').classList.add('hidden');
            showSuccessMessage(`Pengajuan peminjaman ${namaAlat} berhasil. Menunggu persetujuan admin.`);
            
        } catch (error) {
            console.error("Gagal mengajukan peminjaman:", error);
            showErrorMessage("Gagal mengajukan peminjaman: " + error.message);
        } finally {
            showLoader(false);
        }
    });

    // Bukti Peminjaman - Cetak
    document.getElementById('btn-cetak-bukti')?.addEventListener('click', () => {
        const printContent = document.getElementById('bukti-peminjaman-content').innerHTML;
        const originalContent = document.body.innerHTML;
        
        document.body.innerHTML = `
            <div class="p-8">
                <div class="text-center mb-6">
                    <h1 class="text-2xl font-bold">SPORTSPACE</h1>
                    <p class="text-gray-600">Sistem Peminjaman Alat Olahraga</p>
                </div>
                ${printContent}
                <div class="mt-8 text-center text-sm text-gray-500">
                    <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
                </div>
            </div>
        `;
        
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload();
    });

    // Bukti Peminjaman - Tutup
    document.getElementById('btn-tutup-bukti')?.addEventListener('click', () => {
        document.getElementById('modal-bukti-peminjaman').classList.add('hidden');
    });

    // Pengaturan Denda
    document.getElementById('form-denda')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole !== 'Admin') return;
        
        showLoader(true);
        const dendaBaru = parseInt(document.getElementById('denda-per-hari').value);
        
        const pengaturanBaru = {
            dendaPerHari: dendaBaru
        };
        
        try {
            const docRef = doc(db, pengaturanCollectionPath, "sistem");
            await setDoc(docRef, pengaturanBaru);
            
            pengaturanSistem = pengaturanBaru;
            showSuccessMessage("Pengaturan berhasil disimpan.");
            
        } catch (error) {
            console.error("Gagal simpan pengaturan:", error);
            showErrorMessage("Gagal simpan pengaturan: " + error.message);
        } finally {
            showLoader(false);
        }
    });

    // Pastikan semua halaman tersembunyi di awal
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    
    // Tambahkan fallback untuk menampilkan pesan jika data tidak bisa dimuat
    setTimeout(() => {
        const tables = ['dashboard-pinjaman-saya', 'riwayat-table-body'];
        tables.forEach(tableId => {
            const tbody = document.getElementById(tableId);
            if (tbody && tbody.innerHTML.includes('Memuat data...')) {
                tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-yellow-600">Data sedang dimuat... Jika terlalu lama, periksa koneksi internet dan aturan Firestore.</td></tr>';
            }
        });
    }, 5000);
});

// ===================================
// Autentikasi Firebase
// ===================================

onAuthStateChanged(auth, async (user) => {
    showLoader(true);
    if (user) {
        // Pengguna login
        currentUser = user;
        
        try {
            // 1. Ambil data pengguna dari Firestore
            userDocRef = doc(db, penggunaCollectionPath, user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Jika tidak ada dokumen, ini adalah login pertama (setelah register)
                console.warn("Dokumen pengguna tidak ditemukan saat login, membuat baru...");
                await setDoc(userDocRef, {
                    uid: user.uid,
                    nama: user.displayName || "Pengguna Baru",
                    email: user.email,
                    peran: 'User', // Default role
                    createdAt: serverTimestamp()
                });
                userRole = 'User';
            } else {
                // Pengguna ada, dapatkan perannya
                userRole = userDoc.data().peran || 'User';
            }

            // 2. Setup UI Aplikasi
            setupUIForUser();
            
            // 3. Muat data awal (listener)
            await initAppSettings(); // Muat pengaturan dulu
            initListeners(user.uid); // Muat listener data

            // Inisialisasi data admin segera setelah login
            if (userRole === 'Admin') {
                await initAdminData();
            }

            // 4. Tampilkan Aplikasi, Sembunyikan Auth
            document.getElementById('user-display-name').textContent = user.displayName || user.email;
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('landing-page').classList.add('hidden');
            showPage('page-dashboard'); // Halaman default

        } catch (error) {
            console.error("Error saat inisialisasi data pengguna:", error);
            showErrorMessage("Gagal memuat data pengguna. " + error.message);
            await signOut(auth); // Logout jika gagal inisialisasi
        }

    } else {
        // Pengguna logout
        currentUser = null;
        userRole = 'User';
        
        // Hentikan semua listener
        stopListeners();
        
        // Tampilkan Landing Page, Sembunyikan Aplikasi & Auth
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('landing-page').classList.remove('hidden');
    }
    showLoader(false);
});

// ===================================
// Fungsi Global untuk HTML onclick
// ===================================

// Fungsi Edit Alat
window.handleEditAlat = (id) => {
    const alat = globalAlatData.find(a => a.id === id);
    if (!alat) return showErrorMessage("Alat tidak ditemukan!");
    
    document.getElementById('form-alat-id').value = alat.id;
    document.getElementById('form-alat-nama').value = alat.nama;
    document.getElementById('form-alat-deskripsi').value = alat.deskripsi || '';
    document.getElementById('form-alat-stok').value = alat.stokTotal;
    document.getElementById('form-alat-kondisi').value = alat.kondisi;
    document.getElementById('form-alat-lokasi').value = alat.lokasi || '';
    
    // Handle gambar existing
    const previewContainer = document.getElementById('gambar-preview-container');
    const previewImage = document.getElementById('gambar-preview');
    const gambarInfo = document.getElementById('gambar-info');
    const urlInput = document.getElementById('form-alat-gambar-url');
    
    if (alat.gambar) {
        if (alat.gambarType === 'base64') {
            // Tampilkan base64 image
            previewImage.src = alat.gambar;
            previewImage.classList.remove('hidden');
            gambarInfo.textContent = 'Gambar dari database';
            previewContainer.classList.remove('hidden');
            urlInput.value = '';
        } else {
            // Tampilkan URL
            urlInput.value = alat.gambar;
            previewContainer.classList.add('hidden');
        }
    } else {
        previewContainer.classList.add('hidden');
        urlInput.value = '';
    }
    
    // Reset file input
    selectedImageFile = null;
    document.getElementById('form-alat-gambar-file').value = '';
    
    document.getElementById('modal-alat-title').textContent = 'Edit Alat';
    document.getElementById('modal-alat').classList.remove('hidden');
};

// Fungsi Hapus Alat
window.handleHapusAlat = async (id, nama) => {
    if (userRole !== 'Admin') return showErrorMessage("Hanya Admin yang bisa menghapus alat.");
    
    showConfirmationMessage(`Apakah Anda yakin ingin menghapus alat "${nama}"?`, async () => {
        showLoader(true);
        try {
            const q = query(collection(db, peminjamanCollectionPath), where("alatId", "==", id), where("status", "==", "Dipinjam"), limit(1));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                throw new Error("Alat ini sedang dipinjam dan tidak bisa dihapus.");
            }
            
            await deleteDoc(doc(db, alatCollectionPath, id));
            showSuccessMessage(`Alat "${nama}" berhasil dihapus.`);
            
        } catch (error) {
            console.error("Gagal hapus alat:", error);
            showErrorMessage(`Gagal hapus alat: ${error.message}.`);
        } finally {
            showLoader(false);
        }
    });
};

// Fungsi Detail Peminjaman
window.handleDetailPeminjaman = (alatId, namaAlat) => {
    document.getElementById('detail-alat-id').value = alatId;
    document.getElementById('detail-alat-nama').value = namaAlat;
    document.getElementById('detail-nama-alat').textContent = namaAlat;
    
    // Set tanggal default
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    document.getElementById('detail-tanggal-pinjam').value = today.toISOString().split('T')[0];
    document.getElementById('detail-tanggal-kembali').value = nextWeek.toISOString().split('T')[0];
    
    // Set jumlah default
    document.getElementById('detail-jumlah').value = 1;
    
    document.getElementById('modal-detail-peminjaman').classList.remove('hidden');
};

// Fungsi untuk admin memproses pengembalian
window.handleAdminKembalikan = async (peminjamanId, alatId, namaAlat, namaPeminjam, jumlah = 1) => {
    if (userRole !== 'Admin') {
        showErrorMessage("Hanya admin yang dapat memproses pengembalian.");
        return;
    }
    
    const peminjamanRef = doc(db, peminjamanCollectionPath, peminjamanId);
    const peminjamanSnap = await getDoc(peminjamanRef);
    if (!peminjamanSnap.exists()) return showErrorMessage("Data peminjaman tidak ditemukan!");
    const peminjaman = peminjamanSnap.data();
    
    const today = new Date();
    let denda = 0;
    let message = `Anda akan memproses pengembalian "${namaAlat}" dari ${namaPeminjam}.`;
    
    // Hitung denda jika ada keterlambatan
    if (peminjaman.tglBatasKembali) {
        try {
            let batasKembali;
            if (peminjaman.tglBatasKembali.toDate) {
                batasKembali = peminjaman.tglBatasKembali.toDate();
            } else if (peminjaman.tglBatasKembali instanceof Date) {
                batasKembali = peminjaman.tglBatasKembali;
            } else {
                batasKembali = new Date(peminjaman.tglBatasKembali);
            }
            
            const hariTerlambat = selisihHari(batasKembali, today);
            if (hariTerlambat > 0) {
                denda = hariTerlambat * pengaturanSistem.dendaPerHari * (peminjaman.jumlah || 1);
                message += `\nPeminjaman terlambat ${hariTerlambat} hari. Denda: ${formatRupiah(denda)}.`;
            } else {
                message += "\nPengembalian tepat waktu. Tidak ada denda.";
            }
        } catch (error) {
            console.error("Error menghitung denda:", error);
            message += "\nError menghitung denda. Mengembalikan tanpa denda.";
        }
    } else {
        message += "\nBatas kembali tidak terdeteksi. Mengembalikan tanpa denda.";
    }
    
    message += "\nLanjutkan?";
    
    showConfirmationMessage(message, async () => {
        showLoader(true);
        try {
            // Update status peminjaman menjadi "Dikembalikan"
            await updateDoc(peminjamanRef, {
                status: "Dikembalikan",
                tglKembali: serverTimestamp(),
                denda: denda
            });
            
            // Kembalikan stok alat
            const alatRef = doc(db, alatCollectionPath, alatId);
            const alatSnap = await getDoc(alatRef);
            if (alatSnap.exists()) {
                const alatData = alatSnap.data();
                const stokTersediaLama = alatData.stokTersedia || 0;
                await updateDoc(alatRef, {
                    stokTersedia: stokTersediaLama + (peminjaman.jumlah || 1)
                });
            }
            
            showSuccessMessage(`Pengembalian ${namaAlat} dari ${namaPeminjam} berhasil diproses.`);
            
        } catch (error) {
            console.error("Gagal memproses pengembalian:", error);
            showErrorMessage("Gagal memproses pengembalian: " + error.message);
        } finally {
            showLoader(false);
        }
    });
};

// Fungsi Setujui Peminjaman
window.handleSetujuiPeminjaman = async (peminjamanId, alatId, jumlah = 1) => {
    showConfirmationMessage("Apakah Anda yakin ingin menyetujui peminjaman ini?", async () => {
        showLoader(true);
        try {
            const peminjamanRef = doc(db, peminjamanCollectionPath, peminjamanId);
            await updateDoc(peminjamanRef, {
                status: "Dipinjam"
            });
            
            // Kurangi stok tersedia alat
            const alatRef = doc(db, alatCollectionPath, alatId);
            const alatSnap = await getDoc(alatRef);
            if (alatSnap.exists()) {
                const alatData = alatSnap.data();
                const stokTersediaLama = alatData.stokTersedia || 0;
                await updateDoc(alatRef, {
                    stokTersedia: stokTersediaLama - jumlah
                });
            }
            
            showSuccessMessage("Peminjaman berhasil disetujui.");
            
        } catch (error) {
            console.error("Gagal menyetujui peminjaman:", error);
            showErrorMessage("Gagal menyetujui peminjaman: " + error.message);
        } finally {
            showLoader(false);
        }
    });
};

// Fungsi Tolak Peminjaman
window.handleTolakPeminjaman = async (peminjamanId) => {
    showConfirmationMessage("Apakah Anda yakin ingin menolak peminjaman ini?", async () => {
        showLoader(true);
        try {
            const peminjamanRef = doc(db, peminjamanCollectionPath, peminjamanId);
            await updateDoc(peminjamanRef, {
                status: "Ditolak"
            });
            
            showSuccessMessage("Peminjaman berhasil ditolak.");
            
        } catch (error) {
            console.error("Gagal menolak peminjaman:", error);
            showErrorMessage("Gagal menolak peminjaman: " + error.message);
        } finally {
            showLoader(false);
        }
    });
};

// Fungsi Toggle Admin
window.toggleAdmin = async (userId, jadiAdmin) => {
    const peranBaru = jadiAdmin ? 'Admin' : 'User';
    const userRef = doc(db, penggunaCollectionPath, userId);
    
    showConfirmationMessage(`Anda yakin ingin mengubah peran pengguna ini menjadi ${peranBaru}?`, async () => {
        showLoader(true);
        try {
            await updateDoc(userRef, {
                peran: peranBaru
            });
            showSuccessMessage("Peran pengguna berhasil diubah.");
        } catch (error) {
            console.error("Gagal mengubah peran:", error);
            showErrorMessage("Gagal mengubah peran: " + error.message);
        } finally {
            showLoader(false);
        }
    });
};

// Fungsi Cetak Laporan
window.cetakLaporan = function() {
    // Update informasi cetak
    document.getElementById('print-tanggal-cetak').textContent = new Date().toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Tampilkan elemen-elemen print yang sebelumnya tersembunyi
    const printElements = document.querySelectorAll('.print-header, .print-info, .print-summary');
    printElements.forEach(el => {
        el.classList.remove('hidden');
    });
    
    // Tambahkan kelas printing ke body
    document.body.classList.add('printing');
    
    // Jalankan print
    window.print();
    
    // Setelah selesai print, kembalikan ke keadaan semula
    window.onafterprint = () => {
        document.body.classList.remove('printing');
        printElements.forEach(el => {
            el.classList.add('hidden');
        });
    };
    
    // Fallback jika onafterprint tidak didukung
    setTimeout(() => {
        document.body.classList.remove('printing');
        printElements.forEach(el => {
            el.classList.add('hidden');
        });
    }, 1000);
};

// Fungsi untuk debug
window.debugData = function() {
    console.log("=== DEBUG DATA ===");
    console.log("Current User:", currentUser);
    console.log("User Role:", userRole);
    console.log("Global Alat Data:", globalAlatData);
    console.log("Global Peminjaman Data:", globalPeminjamanData);
    console.log("Pengaturan Sistem:", pengaturanSistem);
    console.log("===================");
};

// ===================================
// Fungsi Render Halaman Lainnya
// ===================================

// --- Pinjam Alat ---
function renderPeminjamanPage(alatData) {
    const grid = document.getElementById('peminjaman-grid');
    if (!grid) return;
    
    const tersedia = alatData.filter(alat => (alat.stokTersedia || 0) > 0 && alat.kondisi === 'Baik');
    
    if (tersedia.length === 0) {
        const searchTerm = document.getElementById('search-peminjaman-input')?.value || '';
        if (searchTerm) {
            grid.innerHTML = '<p class="text-gray-500 col-span-full text-center">Tidak ada alat yang cocok dengan pencarian Anda atau sedang tidak tersedia.</p>';
        } else {
            grid.innerHTML = '<p class="text-gray-500 col-span-full text-center">Tidak ada alat yang tersedia untuk dipinjam saat ini.</p>';
        }
        return;
    }
    
    grid.innerHTML = tersedia.map(alat => {
        // Handle gambar - jika base64, gunakan langsung, jika URL gunakan URL
        const gambarSrc = alat.gambarType === 'base64' ? alat.gambar : (alat.gambar || 'https://placehold.co/300x192/60a5fa/ffffff?text=Alat');
        
        return `
            <div class="bg-white shadow-lg rounded-xl overflow-hidden flex flex-col">
                <img class="h-48 w-full object-cover" src="${gambarSrc}" alt="${alat.nama}" onerror="this.src='https://placehold.co/300x192/60a5fa/ffffff?text=Alat'">
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="text-lg font-semibold text-gray-900">${alat.nama}</h3>
                    <p class="text-sm text-gray-500 mt-1">${alat.deskripsi || 'Tidak ada deskripsi.'}</p>
                    <div class="mt-4 pt-4 border-t border-gray-100 flex-grow flex items-end justify-between">
                        <div>
                            <span class="text-sm text-gray-500">Stok Tersedia:</span>
                            <span class="text-sm font-bold text-green-600">${alat.stokTersedia}</span>
                        </div>
                        <button onclick="handleDetailPeminjaman('${alat.id}', '${alat.nama}')" class="py-2 px-4 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition">
                            Pinjam
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- Kelola Pengembalian (Admin) ---
function renderKelolaPengembalianPage(peminjamanData) {
    const tbody = document.getElementById('kelola-pengembalian-table-body');
    if (!tbody) {
        console.log("Tabel kelola pengembalian tidak ditemukan");
        return;
    }
    
    // Filter hanya peminjaman dengan status "Dipinjam"
    const aktif = peminjamanData.filter(p => p.status === 'Dipinjam');
    
    console.log("Data untuk kelola pengembalian:", aktif);
    
    if (aktif.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Tidak ada alat yang sedang dipinjam.</td></tr>';
        return;
    }
    
    tbody.innerHTML = aktif.map(p => {
        const jumlah = p.jumlah || 1;
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaPeminjam || 'Tidak diketahui'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaAlat}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglPinjam)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglBatasKembali)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${jumlah}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${renderStatusSpan(p)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button onclick="handleAdminKembalikan('${p.id}', '${p.alatId}', '${p.namaAlat}', '${p.namaPeminjam}', ${jumlah})" 
                            class="py-2 px-4 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition">
                        Proses Pengembalian
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Riwayat Peminjaman ---
function renderRiwayatPage(peminjamanSaya) {
    const tbody = document.getElementById('riwayat-table-body');
    if (!tbody) {
        console.log("Tabel riwayat tidak ditemukan");
        return;
    }
    
    // Urutkan dari yang terbaru
    const riwayat = [...peminjamanSaya].sort((a, b) => {
        try {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return dateB - dateA;
        } catch (error) {
            return 0;
        }
    });
    
    console.log("Data untuk riwayat:", riwayat);
    
    if (riwayat.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Belum ada riwayat peminjaman.</td></tr>';
        return;
    }
    
    tbody.innerHTML = riwayat.map(p => {
        const jumlah = p.jumlah || 1;
        const denda = p.denda || 0;
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaAlat}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglPinjam)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.status === 'Dikembalikan' ? formatTanggal(p.tglKembali) : '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${renderStatusSpan(p)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${formatRupiah(denda)}</td>
            </tr>
        `;
    }).join('');
}

// --- Persetujuan Peminjaman (Admin) ---
function renderPersetujuanPage(peminjamanData) {
    const tbody = document.getElementById('persetujuan-table-body');
    if (!tbody) return;

    if (peminjamanData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Tidak ada permintaan peminjaman yang menunggu persetujuan.</td></tr>';
        return;
    }

    tbody.innerHTML = peminjamanData.map(p => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaPeminjam || p.userId}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.namaAlat}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglPinjam)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglBatasKembali)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${renderStatusSpan(p)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button onclick="handleSetujuiPeminjaman('${p.id}', '${p.alatId}', ${p.jumlah || 1})" class="text-green-600 hover:text-green-900">Setujui</button>
                <button onclick="handleTolakPeminjaman('${p.id}')" class="text-red-600 hover:text-red-900">Tolak</button>
            </td>
        </tr>
    `).join('');
}

// --- Laporan (Admin) ---
function renderLaporanPage(peminjamanData) {
    const tbody = document.getElementById('laporan-table-body');
    if (!tbody) return;

    if (peminjamanData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Belum ada riwayat peminjaman.</td></tr>';
        return;
    }

    // Hitung statistik untuk summary
    const totalPeminjaman = peminjamanData.length;
    const disetujui = peminjamanData.filter(p => p.status === 'Dipinjam' || p.status === 'Dikembalikan').length;
    const ditolak = peminjamanData.filter(p => p.status === 'Ditolak').length;
    const totalDenda = peminjamanData.reduce((sum, p) => sum + (p.denda || 0), 0);

    tbody.innerHTML = peminjamanData.map(p => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${p.namaPeminjam || p.userId}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.namaAlat}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTanggal(p.tglPinjam)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.status === 'Dikembalikan' ? formatTanggal(p.tglKembali) : '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${renderStatusSpan(p)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${formatRupiah(p.denda || 0)}</td>
        </tr>
    `).join('');

    // Update print area dengan data yang sama + summary
    const printTbody = document.getElementById('laporan-print-area')?.querySelector('tbody');
    if (printTbody) {
        printTbody.innerHTML = peminjamanData.map(p => `
            <tr>
                <td>${p.namaPeminjam || p.userId}</td>
                <td>${p.namaAlat}</td>
                <td>${formatTanggal(p.tglPinjam)}</td>
                <td>${p.status === 'Dikembalikan' ? formatTanggal(p.tglKembali) : '-'}</td>
                <td><span class="status-badge ${getStatusClass(p)}">${getStatusText(p)}</span></td>
                <td>${formatRupiah(p.denda || 0)}</td>
            </tr>
        `).join('');
    }

    // Tambahkan summary ke print area
    let printSummary = document.getElementById('laporan-print-area-wrapper')?.querySelector('.print-summary');
    if (!printSummary) {
        printSummary = document.createElement('div');
        printSummary.className = 'print-summary hidden';
        document.getElementById('laporan-print-area-wrapper').appendChild(printSummary);
    }
    
    printSummary.innerHTML = `
        <h3>Ringkasan Laporan</h3>
        <p><strong>Total Peminjaman:</strong> ${totalPeminjaman} transaksi</p>
        <p><strong>Disetujui:</strong> ${disetujui} peminjaman</p>
        <p><strong>Ditolak:</strong> ${ditolak} peminjaman</p>
        <p><strong>Total Denda:</strong> ${formatRupiah(totalDenda)}</p>
        <p><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>
    `;
}

// Helper functions untuk print
function getStatusClass(peminjaman) {
    if (peminjaman.status === 'Dikembalikan') return 'status-returned';
    if (peminjaman.status === 'Menunggu Persetujuan') return 'status-waiting';
    if (peminjaman.status === 'Ditolak') return 'status-rejected';
    return 'status-approved';
}

function getStatusText(peminjaman) {
    if (peminjaman.status === 'Dikembalikan') return 'Dikembalikan';
    if (peminjaman.status === 'Menunggu Persetujuan') return 'Menunggu';
    if (peminjaman.status === 'Ditolak') return 'Ditolak';
    
    if (peminjaman.tglBatasKembali) {
        try {
            const today = new Date();
            let batasKembali;
            if (peminjaman.tglBatasKembali.toDate) {
                batasKembali = peminjaman.tglBatasKembali.toDate();
            } else if (peminjaman.tglBatasKembali instanceof Date) {
                batasKembali = peminjaman.tglBatasKembali;
            } else {
                batasKembali = new Date(peminjaman.tglBatasKembali);
            }
            
            if (batasKembali < today) {
                return 'Terlambat';
            }
        } catch (error) {
            console.error("Error getStatusText:", error);
        }
    }
    return 'Dipinjam';
}

// --- Manajemen Pengguna (Admin) ---
function renderPenggunaPage(penggunaData) {
    const tbody = document.getElementById('pengguna-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = penggunaData.map(user => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.nama}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.peran}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${ user.peran !== 'Admin' ? 
                   `<button onclick="toggleAdmin('${user.id}', true)" class="text-blue-600 hover:text-blue-900">Jadikan Admin</button>` : 
                   (user.uid !== currentUser.uid ?
                   `<button onclick="toggleAdmin('${user.id}', false)" class="text-yellow-600 hover:text-yellow-900">Jadikan User</button>` : 
                   '<span class="text-gray-400">(Anda)</span>')
                }
            </td>
        </tr>
    `).join('');
}

// --- Bukti Peminjaman ---
function tampilkanBuktiPeminjaman(data) {
    document.getElementById('bukti-no-peminjaman').textContent = data.id;
    document.getElementById('bukti-tanggal').textContent = formatTanggal(new Date());
    document.getElementById('bukti-nama-peminjam').textContent = data.namaPeminjam;
    document.getElementById('bukti-nama-alat').textContent = data.namaAlat;
    document.getElementById('bukti-tujuan').textContent = data.tujuan;
    document.getElementById('bukti-lokasi').textContent = data.lokasi;
    document.getElementById('bukti-tanggal-pinjam').textContent = formatTanggal(data.tanggalPinjam);
    document.getElementById('bukti-tanggal-kembali').textContent = formatTanggal(data.tanggalKembali);
    
    // Tambahkan jumlah barang di bukti peminjaman
    const jumlahEl = document.createElement('div');
    jumlahEl.innerHTML = `
        <p class="text-sm text-gray-500">Jumlah Barang</p>
        <p class="font-medium">${data.jumlah || 1}</p>
    `;
    document.getElementById('bukti-peminjaman-content').querySelector('.grid').appendChild(jumlahEl);
    
    const statusEl = document.getElementById('bukti-status');
    statusEl.textContent = data.status;
    statusEl.className = 'font-medium px-2 py-1 rounded inline-block ';
    
    if (data.status === 'Menunggu Persetujuan') {
        statusEl.classList.add('status-waiting');
    } else if (data.status === 'Dipinjam') {
        statusEl.classList.add('status-approved');
    } else if (data.status === 'Ditolak') {
        statusEl.classList.add('status-rejected');
    } else {
        statusEl.classList.add('status-returned');
    }
    
    document.getElementById('modal-bukti-peminjaman').classList.remove('hidden');
}

console.log("SportSpace Application Loaded Successfully!");
